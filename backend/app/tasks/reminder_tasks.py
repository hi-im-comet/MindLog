"""
Celery 리마인더 태스크.
매 분마다 폴링하여 예약된 체크인을 처리한다.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone, timedelta

from app.tasks.celery_app import celery

logger = logging.getLogger(__name__)


@celery.task(name='app.tasks.reminder_tasks.poll_due_reminders', bind=True, max_retries=3)
def poll_due_reminders(self):
    """
    매 분 실행: 예약 시각이 지난 pending 체크인을 처리하고,
    15분 무응답 sent 체크인에 팔로업을 발송한다.
    """
    from app.models.check_in import CheckIn
    from app.models.user_profile import UserProfile

    now = datetime.now(timezone.utc)

    # 1. 예약 시각이 지난 pending 체크인 처리
    due = CheckIn.query.filter(
        CheckIn.status == 'pending',
        CheckIn.scheduled_at <= now,
    ).all()

    for check_in in due:
        profile = UserProfile.query.filter_by(user_id=check_in.user_id).first()
        if profile and not profile.reminders_enabled:
            continue
        if _is_quiet_hours(profile, now):
            continue
        send_check_in_notification.delay(str(check_in.id))

    # 2. 15분 무응답 팔로업
    followup_cutoff = now - timedelta(minutes=15)
    stale = CheckIn.query.filter(
        CheckIn.status == 'sent',
        CheckIn.notification_sent_at <= followup_cutoff,
        CheckIn.followup_sent_at.is_(None),
    ).all()

    for check_in in stale:
        send_followup_message.delay(str(check_in.id))


@celery.task(name='app.tasks.reminder_tasks.send_check_in_notification', bind=True, max_retries=3)
def send_check_in_notification(self, check_in_id: str):
    """
    체크인 알림을 발송한다:
    1. status → sent
    2. AI 오프너 메시지 생성 및 저장
    3. 푸시 알림 발송
    4. 재발 처리
    """
    from app.extensions import db
    from app.models.check_in import CheckIn, VALID_RECURRENCES
    from app.models.check_in_message import CheckInMessage
    from app.services.check_in_ai import build_opener
    from app.services.push_service import send_push_to_user

    check_in = CheckIn.query.get(check_in_id)
    if not check_in or check_in.status != 'pending':
        return

    now = datetime.now(timezone.utc)

    # AI 오프너 메시지 생성
    try:
        opener_content = build_opener(check_in)
    except Exception as e:
        logger.error(f'오프너 생성 실패 check_in={check_in_id}: {e}')
        opener_content = f'안녕하세요! "{check_in.title}" 어떻게 되어가고 있나요?'

    # 상태 업데이트
    check_in.status = 'sent'
    check_in.notification_sent_at = now

    # 메시지 저장
    msg = CheckInMessage(
        check_in_id=check_in.id,
        role='ai',
        content=opener_content,
        model_used='claude-haiku-4-5-20251001',
    )
    db.session.add(msg)

    # 재발 체크인 생성
    if check_in.recurrence == 'daily':
        _create_next_check_in(check_in, timedelta(days=1))
    elif check_in.recurrence == 'weekly':
        _create_next_check_in(check_in, timedelta(weeks=1))

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f'체크인 알림 DB 저장 실패: {e}')
        raise self.retry(exc=e, countdown=60)

    # 푸시 알림 발송
    try:
        send_push_to_user(str(check_in.user_id), {
            'title': '체크인 알림',
            'body': opener_content[:80],
            'url': f'/reminders/{check_in_id}/chat',
        })
    except Exception as e:
        logger.error(f'푸시 알림 발송 실패: {e}')


@celery.task(name='app.tasks.reminder_tasks.send_followup_message', bind=True, max_retries=3)
def send_followup_message(self, check_in_id: str):
    """
    15분 무응답 팔로업 메시지를 발송한다.
    """
    from app.extensions import db
    from app.models.check_in import CheckIn
    from app.models.check_in_message import CheckInMessage
    from app.services.check_in_ai import build_followup
    from app.services.push_service import send_push_to_user

    check_in = CheckIn.query.get(check_in_id)
    if not check_in or check_in.status != 'sent' or check_in.followup_sent_at:
        return

    now = datetime.now(timezone.utc)

    try:
        followup_content = build_followup(check_in)
    except Exception as e:
        logger.error(f'팔로업 생성 실패 check_in={check_in_id}: {e}')
        followup_content = '바쁘시면 나중에 확인해도 괜찮아요! 😊'

    check_in.followup_sent_at = now

    msg = CheckInMessage(
        check_in_id=check_in.id,
        role='ai',
        content=followup_content,
        model_used='claude-haiku-4-5-20251001',
    )
    db.session.add(msg)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f'팔로업 DB 저장 실패: {e}')
        raise self.retry(exc=e, countdown=60)

    try:
        send_push_to_user(str(check_in.user_id), {
            'title': '체크인 팔로업',
            'body': followup_content[:80],
            'url': f'/reminders/{check_in_id}/chat',
        })
    except Exception as e:
        logger.error(f'팔로업 푸시 발송 실패: {e}')


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _is_quiet_hours(profile, now: datetime) -> bool:
    """방해금지 시간대인지 확인한다."""
    if not profile:
        return False
    start = profile.quiet_hours_start
    end = profile.quiet_hours_end
    if start is None or end is None:
        return False
    hour = now.hour
    if start <= end:
        return start <= hour < end
    else:
        # 자정을 넘는 경우 (예: 22~8시)
        return hour >= start or hour < end


def _create_next_check_in(source, delta: timedelta):
    """재발 체크인을 생성한다."""
    from app.extensions import db
    from app.models.check_in import CheckIn

    next_check_in = CheckIn(
        user_id=source.user_id,
        title=source.title,
        scheduled_at=source.scheduled_at + delta,
        recurrence=source.recurrence,
        tone=source.tone,
        status='pending',
        source_entry_id=source.source_entry_id,
    )
    db.session.add(next_check_in)
