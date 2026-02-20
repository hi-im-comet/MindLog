"""
패턴 분석 Celery 태스크.

Celery Beat 스케줄: 매주 월요일 06:00 UTC 모든 활성 사용자 패턴 분석
수동 트리거: POST /api/patterns/generate (일 1회 제한)
"""
from __future__ import annotations
import logging
from datetime import date, timedelta

from app.tasks.celery_app import celery
from app.extensions import db

logger = logging.getLogger(__name__)


@celery.task(bind=True, max_retries=2, default_retry_delay=120)
def analyze_user_patterns(self, user_id: str, period_days: int = 7):
    """특정 사용자의 패턴 분석을 실행하는 Celery 태스크."""
    try:
        from app.services.pattern_analyzer import analyze_patterns
        log = analyze_patterns(user_id, period_days=period_days)
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
    Celery Beat 스케줄 태스크: 매주 월요일 모든 활성 사용자 패턴 분석.
    최근 30일 안에 일기를 3개 이상 쓴 사용자만 대상.
    """
    from app.models.journal_entry import JournalEntry

    cutoff = date.today() - timedelta(days=30)
    active_user_ids = (
        db.session.query(JournalEntry.user_id)
        .filter(JournalEntry.entry_date >= cutoff)
        .filter(JournalEntry.is_draft.is_(False))
        .filter(JournalEntry.deleted_at.is_(None))
        .group_by(JournalEntry.user_id)
        .having(db.func.count(JournalEntry.id) >= 3)
        .all()
    )

    count = len(active_user_ids)
    logger.info(f'주간 패턴 분석 시작: 대상 {count}명')
    for (user_id,) in active_user_ids:
        analyze_user_patterns.delay(str(user_id), period_days=7)
    return count
