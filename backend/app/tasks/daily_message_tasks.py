"""
일일 홈 메시지 Celery 태스크.
매 분 폴링하여 daily_message_time이 현재 시각(사용자 TZ)과 일치하는 사용자에게 메시지를 생성한다.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone

from app.tasks.celery_app import celery

logger = logging.getLogger(__name__)


@celery.task(
    name='app.tasks.daily_message_tasks.poll_daily_messages',
    bind=True,
    max_retries=3,
)
def poll_daily_messages(self):
    """
    매 분 실행: daily_message_enabled=True인 사용자 중
    현재 시각(사용자 TZ)이 daily_message_time과 일치하고 오늘 메시지가 없으면
    generate_daily_message_task를 디스패치한다.
    """
    from zoneinfo import ZoneInfo
    from app.models.user_profile import UserProfile
    from app.models.user import User
    from app.models.daily_message import DailyMessage

    utc_now = datetime.now(timezone.utc)

    profiles = UserProfile.query.filter_by(daily_message_enabled=True).all()

    for profile in profiles:
        try:
            user = User.query.filter_by(id=profile.user_id, deleted_at=None).first()
            if not user:
                continue

            tz = ZoneInfo(user.timezone or 'Asia/Seoul')
            local_now = utc_now.astimezone(tz)
            local_hhmm = local_now.strftime('%H:%M')
            today_local = local_now.date()

            target_time = profile.daily_message_time or '08:00'
            if local_hhmm != target_time:
                continue

            # 오늘 이미 생성됐으면 건너뜀
            exists = DailyMessage.query.filter_by(
                user_id=user.id,
                message_date=today_local,
            ).first()
            if exists:
                continue

            generate_daily_message_task.delay(str(user.id))

        except Exception as e:
            logger.error(f'poll_daily_messages 사용자 처리 실패 profile={profile.user_id}: {e}')


@celery.task(
    name='app.tasks.daily_message_tasks.generate_daily_message_task',
    bind=True,
    max_retries=3,
)
def generate_daily_message_task(self, user_id: str):
    """
    실제 메시지 생성 및 저장.
    UNIQUE constraint가 최종 중복 방지를 보장한다.
    """
    from zoneinfo import ZoneInfo
    from app.extensions import db
    from app.models.user import User
    from app.models.daily_message import DailyMessage
    from app.services.daily_message_service import generate_daily_message

    user = User.query.filter_by(id=user_id, deleted_at=None).first()
    if not user:
        return

    tz = ZoneInfo(user.timezone or 'Asia/Seoul')
    today_local = datetime.now(tz).date()

    # Race condition 방어
    if DailyMessage.query.filter_by(user_id=user.id, message_date=today_local).first():
        return

    mood = (user.profile.ai_mood_default if user.profile else None) or 'empathy'
    content = generate_daily_message(user)

    msg = DailyMessage(
        user_id=user.id,
        message_date=today_local,
        content=content,
        ai_mood_used=mood,
    )
    db.session.add(msg)
    try:
        db.session.commit()
        logger.info(f'일일 메시지 생성 완료 user={user_id} date={today_local}')
    except Exception as e:
        db.session.rollback()
        logger.error(f'일일 메시지 저장 실패 user={user_id}: {e}')
        raise self.retry(exc=e, countdown=60)
