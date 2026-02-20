"""
일기 저장 후 실행되는 비동기 AI 처리 파이프라인.

entry 저장 → extract_entry (구조 추출 + 카테고리 자동 태깅) + generate_summary (한줄 요약)
             → 5의 배수 저장마다 update_user_profile_task
"""
from __future__ import annotations
import logging
from app.tasks.celery_app import celery

logger = logging.getLogger(__name__)

# 추출 플래그 → 카테고리 이름 매핑
_FLAG_TO_CATEGORY = {
    'work_mentioned': '업무',
    'sleep_mentioned': '수면',
    'meals_mentioned': '식사',
    'exercise_mentioned': '운동',
}

# 관계 관련 토픽 키워드
_RELATION_KEYWORDS = ['가족', '친구', '연인', '동료', '부모', '형제', '동생', '남자친구', '여자친구', '선생님', '상사']


def _auto_assign_categories(entry, data: dict) -> None:
    """AI 추출 결과를 기반으로 카테고리를 자동 태깅한다."""
    from app.models.journal_category import JournalCategory

    target_names: set = set()

    for flag, cat_name in _FLAG_TO_CATEGORY.items():
        if data.get(flag):
            target_names.add(cat_name)

    # 감정 키워드가 있으면 기분 카테고리
    if data.get('mood_keywords'):
        target_names.add('기분')

    # 토픽에 관계 키워드가 포함되면 관계 카테고리
    for topic in data.get('topics', []):
        if any(kw in topic for kw in _RELATION_KEYWORDS):
            target_names.add('관계')
            break

    if not target_names:
        return

    cats = JournalCategory.query.filter(
        JournalCategory.user_id == str(entry.user_id),
        JournalCategory.name.in_(target_names),
        JournalCategory.is_active.is_(True),
    ).all()

    entry.categories = cats


@celery.task(bind=True, max_retries=3, default_retry_delay=30)
def extract_entry(self, entry_id: str) -> dict:
    """일기 원문에서 mood_keywords, stress_indicators 등을 추출해 저장하고 카테고리를 자동 태깅한다."""
    from datetime import datetime, timezone
    from app.extensions import db
    from app.models.journal_entry import JournalEntry
    from app.models.entry_ai_extraction import EntryAIExtraction
    from app.services.entry_extractor import extract_from_content
    from app.services.ai_service import MODEL_HAIKU

    entry = JournalEntry.query.get(entry_id)
    if not entry or entry.deleted_at:
        logger.warning(f'extract_entry: entry {entry_id} not found or deleted')
        return {}

    try:
        data, usage = extract_from_content(entry.raw_content)
    except Exception as exc:
        logger.error(f'extract_entry: AI 호출 실패 entry={entry_id}: {exc}')
        raise self.retry(exc=exc)

    # 기존 extraction 덮어쓰기
    existing = EntryAIExtraction.query.filter_by(entry_id=entry_id).first()
    if existing:
        db.session.delete(existing)
        db.session.flush()

    extraction = EntryAIExtraction(
        entry_id=entry_id,
        mood_keywords=data.get('mood_keywords', []),
        topics=data.get('topics', []),
        sentiment_score=data.get('sentiment_score'),
        stress_indicators=data.get('stress_indicators', []),
        sleep_mentioned=data.get('sleep_mentioned', False),
        meals_mentioned=data.get('meals_mentioned', False),
        work_mentioned=data.get('work_mentioned', False),
        exercise_mentioned=data.get('exercise_mentioned', False),
        category_segments=data.get('category_segments', []),
        extraction_model=usage.get('model', MODEL_HAIKU),
        extracted_at=datetime.now(timezone.utc),
    )
    db.session.add(extraction)

    # 카테고리 자동 태깅
    try:
        _auto_assign_categories(entry, data)
    except Exception as e:
        logger.warning(f'extract_entry: 카테고리 자동 태깅 실패 entry={entry_id}: {e}')

    db.session.commit()
    logger.info(f'extract_entry: 완료 entry={entry_id} categories={[c.name for c in entry.categories]}')
    return data


@celery.task(bind=True, max_retries=3, default_retry_delay=30)
def generate_summary(self, entry_id: str) -> str:
    """일기의 한줄 요약을 생성해 journal_entries.daily_summary에 저장."""
    from datetime import datetime, timezone
    from app.extensions import db
    from app.models.journal_entry import JournalEntry
    from app.services.summary_service import generate_daily_summary

    entry = JournalEntry.query.get(entry_id)
    if not entry or entry.deleted_at or entry.is_draft:
        return ''

    if entry.daily_summary:
        return entry.daily_summary

    try:
        summary, _ = generate_daily_summary(entry.raw_content)
    except Exception as exc:
        logger.error(f'generate_summary: AI 호출 실패 entry={entry_id}: {exc}')
        raise self.retry(exc=exc)

    entry.daily_summary = summary
    entry.summary_generated_at = datetime.now(timezone.utc)
    db.session.commit()
    logger.info(f'generate_summary: 완료 entry={entry_id} summary="{summary}"')
    return summary


@celery.task(bind=True, max_retries=2, default_retry_delay=60)
def update_user_profile_task(self, user_id: str) -> bool:
    """사용자 AI 프로필 업데이트. 5개 일기마다 호출된다."""
    from app.services.user_profile_service import update_user_profile

    try:
        success = update_user_profile(user_id)
        logger.info(f'update_user_profile_task: user={user_id} success={success}')
        return success
    except Exception as exc:
        logger.error(f'update_user_profile_task: 실패 user={user_id}: {exc}')
        raise self.retry(exc=exc)
