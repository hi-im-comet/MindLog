"""
패턴 분석 Celery 태스크.

Celery Beat 스케줄: 매일 06:00 UTC — 사용자 타임존 기준 주 시작일에 자동 분석
수동 트리거: POST /api/patterns/generate (일 1회 제한)
"""
from __future__ import annotations
import logging
from datetime import date, timedelta

from app.tasks.celery_app import celery
from app.extensions import db

logger = logging.getLogger(__name__)


@celery.task(bind=True, max_retries=2, default_retry_delay=120)
def analyze_user_patterns(self, user_id: str, period_type: str = 'weekly'):
    """특정 사용자의 패턴 분석을 실행하는 Celery 태스크."""
    try:
        from app.services.pattern_analyzer import analyze_patterns
        log = analyze_patterns(user_id, period_type=period_type)
        if log:
            logger.info(f'패턴 분석 완료: user_id={user_id}, log_id={log.id}')
            return str(log.id)
        return None
    except Exception as exc:
        logger.error(f'패턴 분석 태스크 실패 user_id={user_id}: {exc}')
        raise self.retry(exc=exc)


@celery.task
def generate_weekly_patterns():
    """
    Celery Beat 스케줄 태스크: 매일 06:00 UTC 실행.
    각 사용자의 타임존 기준 오늘이 week_start_day와 일치할 때 패턴 분석 트리거.
    최근 30일 안에 일기를 3개 이상 쓴 사용자만 대상.
    """
    from zoneinfo import ZoneInfo
    from datetime import datetime, timezone
    from app.models.user import User
    from app.models.user_profile import UserProfile
    from app.models.journal_entry import JournalEntry

    now_utc = datetime.now(timezone.utc)

    users_profiles = (
        db.session.query(User, UserProfile)
        .join(UserProfile, User.id == UserProfile.user_id)
        .all()
    )

    count = 0
    for user, profile in users_profiles:
        tz = ZoneInfo(user.timezone or 'Asia/Seoul')
        today_local = now_utc.astimezone(tz).date()
        week_start_day = profile.week_start_day if profile.week_start_day is not None else 0

        if today_local.weekday() != week_start_day:
            continue

        cutoff = today_local - timedelta(days=30)
        entry_count = (
            JournalEntry.query
            .filter_by(user_id=str(user.id), is_draft=False)
            .filter(JournalEntry.deleted_at.is_(None))
            .filter(JournalEntry.entry_date >= cutoff)
            .count()
        )
        if entry_count >= 3:
            analyze_user_patterns.delay(str(user.id), period_type='weekly')
            count += 1
            logger.info(f'주간 분석 트리거: user_id={user.id}, week_start_day={week_start_day}')

    logger.info(f'주간 패턴 분석 트리거 완료: {count}명')
    return count
