from __future__ import annotations
import logging
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError
from datetime import date, datetime, timezone

from app.extensions import db
from app.models.journal_entry import JournalEntry
from app.models.journal_category import JournalCategory
from app.models.user_profile import UserProfile
from app.utils.helpers import api_response, api_error
from app.utils.timezone_utils import today_kst, recompute_streak_from_entries

entries_bp = Blueprint('entries', __name__, url_prefix='/api/entries')
logger = logging.getLogger(__name__)


def _run_extraction_sync(entry_id: str) -> None:
    """추출을 동기적으로 즉시 실행한다 (Celery worker 없어도 동작)."""
    from datetime import datetime, timezone
    from app.models.journal_entry import JournalEntry
    from app.models.entry_ai_extraction import EntryAIExtraction
    from app.services.entry_extractor import extract_from_content
    from app.services.ai_service import MODEL_HAIKU
    from app.tasks.entry_tasks import _auto_assign_categories

    entry = JournalEntry.query.get(entry_id)
    if not entry or entry.deleted_at:
        return

    data, _ = extract_from_content(entry.raw_content)

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
        cognitive_distortions=data.get('cognitive_distortions', []),
        extraction_model=MODEL_HAIKU,
        extracted_at=datetime.now(timezone.utc),
    )
    db.session.add(extraction)

    try:
        _auto_assign_categories(entry, data)
    except Exception as e:
        logger.warning(f'카테고리 자동 태깅 실패: {e}')

    db.session.commit()
    logger.info(f'_run_extraction_sync: 완료 entry={entry_id}')


def _trigger_ai_tasks(entry_id: str, user_id: str, is_draft: bool) -> None:
    """일기 저장 후 AI 처리 태스크를 발행한다."""
    if is_draft:
        return  # 임시저장은 AI 처리 안 함

    from app.models.user_profile import UserProfile
    from app.models.pattern_log import PatternLog
    from datetime import date as _date

    # 1. total_entries 카운터 + 연속 기록(streak) 업데이트
    # streak: KST 오늘 포함, 실제 기록(일기) 날짜만으로 재계산. 오늘부터 과거로 연속된 일수.
    from datetime import timedelta
    profile = UserProfile.query.filter_by(user_id=user_id).first()
    if profile:
        profile.total_entries += 1
        try:
            consecutive_days, last_entry_date = recompute_streak_from_entries(user_id, db.session)
            profile.consecutive_days = consecutive_days
            profile.last_entry_date = last_entry_date
            db.session.commit()
        except Exception as e:
            logger.warning(f'total_entries/streak 업데이트 실패: {e}')
            db.session.rollback()
    total = profile.total_entries if profile else 0

    # 2. 추출은 항상 동기 즉시 실행 (Celery worker 없어도 보장)
    try:
        _run_extraction_sync(entry_id)
    except Exception as e:
        logger.warning(f'동기 추출 실패: {e}')

    # 3. 오늘 패턴 분석이 없으면 자동 분석 예약
    today = _date.today()
    existing_today = (
        PatternLog.query
        .filter_by(user_id=user_id)
        .filter(db.func.date(PatternLog.generated_at) == today)
        .first()
    )
    should_analyze = (existing_today is None)

    # 4. Celery로 프로필 업데이트 + 패턴 분석 시도
    try:
        from app.tasks.entry_tasks import update_user_profile_task
        if total >= 1 and total % 5 == 0:
            update_user_profile_task.delay(user_id)
        if should_analyze:
            from app.tasks.pattern_tasks import analyze_user_patterns
            analyze_user_patterns.delay(user_id, period_days=7)
    except Exception as e:
        logger.warning(f'AI 태스크 발행 실패 (Celery 미실행?): {e}')
        try:
            if should_analyze:
                from app.services.pattern_analyzer import analyze_patterns
                analyze_patterns(user_id, period_days=7)
            if total >= 1 and total % 5 == 0:
                from app.services.user_profile_service import update_user_profile
                update_user_profile(user_id)
        except Exception as e2:
            logger.warning(f'동기 AI 처리 실패: {e2}')


class EntryCreateSchema(Schema):
    entry_date = fields.Date(load_default=None)
    title = fields.String(allow_none=True, load_default=None, validate=validate.Length(max=255))
    raw_content = fields.String(required=True, validate=validate.Length(min=1))
    mood_score = fields.Integer(allow_none=True, load_default=None,
                                validate=validate.Range(min=1, max=10))
    energy_score = fields.Integer(allow_none=True, load_default=None,
                                  validate=validate.Range(min=1, max=10))
    category_ids = fields.List(fields.UUID(), load_default=list)
    is_draft = fields.Boolean(load_default=False)


class EntryUpdateSchema(Schema):
    title = fields.String(allow_none=True, validate=validate.Length(max=255))
    raw_content = fields.String(validate=validate.Length(min=1))
    mood_score = fields.Integer(allow_none=True, validate=validate.Range(min=1, max=10))
    energy_score = fields.Integer(allow_none=True, validate=validate.Range(min=1, max=10))
    category_ids = fields.List(fields.UUID())
    is_draft = fields.Boolean()
    is_favorite = fields.Boolean()
    tags = fields.List(fields.String(validate=validate.Length(max=30)), validate=validate.Length(max=10))


create_schema = EntryCreateSchema()
update_schema = EntryUpdateSchema()


def _attach_categories(entry: JournalEntry, category_ids: list, user_id: str):
    """Replace an entry's categories with the given list."""
    if not category_ids:
        entry.categories = []
        return
    cats = JournalCategory.query.filter(
        JournalCategory.id.in_([str(cid) for cid in category_ids]),
        JournalCategory.user_id == user_id,
        JournalCategory.is_active == True,
    ).all()
    entry.categories = cats


@entries_bp.route('', methods=['GET'])
@jwt_required()
def list_entries():
    user_id = get_jwt_identity()
    page = request.args.get('page', 1, type=int)
    limit = min(request.args.get('limit', 20, type=int), 100)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    q = request.args.get('q', '').strip()
    is_favorite = request.args.get('is_favorite')

    query = (JournalEntry.query
             .filter_by(user_id=user_id, is_draft=False)
             .filter(JournalEntry.deleted_at.is_(None))
             .order_by(JournalEntry.entry_date.desc()))

    if start_date:
        query = query.filter(JournalEntry.entry_date >= start_date)
    if end_date:
        query = query.filter(JournalEntry.entry_date <= end_date)
    if q:
        like = f'%{q}%'
        query = query.filter(
            db.or_(
                JournalEntry.raw_content.ilike(like),
                JournalEntry.title.ilike(like),
            )
        )
    if is_favorite == 'true':
        query = query.filter(JournalEntry.is_favorite == True)

    paginated = query.paginate(page=page, per_page=limit, error_out=False)

    return api_response({
        'entries': [e.to_dict(full=False) for e in paginated.items],
        'pagination': {
            'page': page,
            'limit': limit,
            'total': paginated.total,
            'total_pages': paginated.pages,
        },
    })


@entries_bp.route('/by-date/<string:entry_date>', methods=['GET'])
@jwt_required()
def get_entry_by_date(entry_date):
    """날짜로 일기 단건 조회 (draft 포함)."""
    user_id = get_jwt_identity()
    entry = (JournalEntry.query
             .filter_by(user_id=user_id, entry_date=entry_date)
             .filter(JournalEntry.deleted_at.is_(None))
             .first())
    if not entry:
        return api_error('해당 날짜의 일기가 없습니다.', 404)
    return api_response({'entry': entry.to_dict(full=True)})


@entries_bp.route('/calendar', methods=['GET'])
@jwt_required()
def calendar_view():
    user_id = get_jwt_identity()
    year = request.args.get('year', date.today().year, type=int)
    month = request.args.get('month', date.today().month, type=int)

    import calendar
    _, last_day = calendar.monthrange(year, month)
    start = date(year, month, 1)
    end = date(year, month, last_day)

    entries = (JournalEntry.query
               .filter_by(user_id=user_id)
               .filter(JournalEntry.deleted_at.is_(None))
               .filter(JournalEntry.entry_date >= start)
               .filter(JournalEntry.entry_date <= end)
               .all())

    entry_map = {str(e.entry_date): e for e in entries}

    days = []
    for day in range(1, last_day + 1):
        d = date(year, month, day)
        key = str(d)
        if key in entry_map:
            e = entry_map[key]
            days.append({
                'date': key,
                'has_entry': True,
                'entry_id': str(e.id),
                'mood_score': e.mood_score,
                'summary': e.daily_summary,
                'is_draft': e.is_draft,
                'is_locked': e.is_locked or False,
                'is_favorite': e.is_favorite or False,
            })
        else:
            days.append({'date': key, 'has_entry': False})

    return api_response({'month': f'{year}-{month:02d}', 'days': days})


@entries_bp.route('', methods=['POST'])
@jwt_required()
def create_entry():
    user_id = get_jwt_identity()
    try:
        data = create_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('입력값을 확인해주세요.', 422, e.messages)

    entry_date = data.get('entry_date') or today_kst()

    # Upsert: one entry per day per user
    existing = JournalEntry.query.filter_by(
        user_id=user_id, entry_date=entry_date
    ).filter(JournalEntry.deleted_at.is_(None)).first()

    if existing:
        # 이미 존재하면 업데이트 후 반환 (upsert)
        was_draft = existing.is_draft
        existing.raw_content = data['raw_content']
        existing.word_count = len(data['raw_content'].split())
        existing.is_draft = data.get('is_draft', existing.is_draft)
        if data.get('title') is not None:
            existing.title = data['title']
        _attach_categories(existing, data.get('category_ids', []), user_id)
        db.session.commit()
        if was_draft and not existing.is_draft:
            _trigger_ai_tasks(str(existing.id), user_id, is_draft=False)
        return api_response(
            {'entry': existing.to_dict(full=True)},
            message='일기가 저장되었습니다.',
            status=200,
        )

    word_count = len(data['raw_content'].split())
    entry = JournalEntry(
        user_id=user_id,
        entry_date=entry_date,
        title=data.get('title'),
        raw_content=data['raw_content'],
        word_count=word_count,
        mood_score=data.get('mood_score'),
        energy_score=data.get('energy_score'),
        is_draft=data.get('is_draft', False),
    )
    db.session.add(entry)
    db.session.flush()

    _attach_categories(entry, data.get('category_ids', []), user_id)
    db.session.commit()

    # AI 처리 비동기 트리거 (임시저장이 아닐 때만)
    _trigger_ai_tasks(str(entry.id), user_id, is_draft=entry.is_draft)

    return api_response(
        {'entry': entry.to_dict(full=True)},
        message='일기가 저장되었습니다. AI가 분석 중이에요.',
        status=201,
    )


@entries_bp.route('/<uuid:entry_id>', methods=['GET'])
@jwt_required()
def get_entry(entry_id):
    user_id = get_jwt_identity()
    entry = (JournalEntry.query
             .filter_by(id=entry_id, user_id=user_id)
             .filter(JournalEntry.deleted_at.is_(None))
             .first_or_404())
    return api_response({'entry': entry.to_dict(full=True)})


@entries_bp.route('/<uuid:entry_id>', methods=['PATCH'])
@jwt_required()
def update_entry(entry_id):
    user_id = get_jwt_identity()
    entry = (JournalEntry.query
             .filter_by(id=entry_id, user_id=user_id)
             .filter(JournalEntry.deleted_at.is_(None))
             .first_or_404())

    try:
        data = update_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('입력값을 확인해주세요.', 422, e.messages)

    category_ids = data.pop('category_ids', None)
    was_draft = entry.is_draft

    for key, value in data.items():
        setattr(entry, key, value)

    if 'raw_content' in data:
        entry.word_count = len(data['raw_content'].split())

    if category_ids is not None:
        _attach_categories(entry, category_ids, user_id)

    db.session.commit()

    # 임시저장 → 정식 저장으로 전환된 경우 AI 트리거
    if was_draft and not entry.is_draft:
        _trigger_ai_tasks(str(entry.id), user_id, is_draft=False)

    return api_response({'entry': entry.to_dict(full=True)})


@entries_bp.route('/<uuid:entry_id>/lock', methods=['POST'])
@jwt_required()
def lock_entry(entry_id):
    """전역 잠금이 활성화된 경우 일기를 잠근다 (비밀번호는 전역으로 관리)."""
    user_id = get_jwt_identity()
    profile = UserProfile.query.filter_by(user_id=user_id).first()
    if not profile or not profile.entry_lock_enabled:
        return api_error('잠금 기능이 활성화되지 않았습니다. 설정에서 먼저 잠금을 설정해 주세요.', 400)
    entry = (JournalEntry.query
             .filter_by(id=entry_id, user_id=user_id)
             .filter(JournalEntry.deleted_at.is_(None))
             .first_or_404())
    entry.is_locked = True
    db.session.commit()
    return api_response({'entry': entry.to_dict()}, message='잠금이 설정되었습니다.')


@entries_bp.route('/<uuid:entry_id>/unlock', methods=['POST'])
@jwt_required()
def unlock_entry(entry_id):
    """일기 잠금을 해제한다 (비밀번호 검증은 /api/users/me/verify-lock에서 처리)."""
    user_id = get_jwt_identity()
    entry = (JournalEntry.query
             .filter_by(id=entry_id, user_id=user_id)
             .filter(JournalEntry.deleted_at.is_(None))
             .first_or_404())
    if not entry.is_locked:
        return api_error('잠금된 일기가 아닙니다.', 400)
    entry.is_locked = False
    db.session.commit()
    return api_response({'entry': entry.to_dict()}, message='잠금이 해제되었습니다.')


@entries_bp.route('/<uuid:entry_id>/favorite', methods=['POST'])
@jwt_required()
def toggle_favorite(entry_id):
    """즐겨찾기 토글."""
    user_id = get_jwt_identity()
    entry = (JournalEntry.query
             .filter_by(id=entry_id, user_id=user_id)
             .filter(JournalEntry.deleted_at.is_(None))
             .first_or_404())
    entry.is_favorite = not (entry.is_favorite or False)
    db.session.commit()
    return api_response({'entry': entry.to_dict(), 'is_favorite': entry.is_favorite})


@entries_bp.route('/<uuid:entry_id>', methods=['DELETE'])
@jwt_required()
def delete_entry(entry_id):
    user_id = get_jwt_identity()
    entry = (JournalEntry.query
             .filter_by(id=entry_id, user_id=user_id)
             .filter(JournalEntry.deleted_at.is_(None))
             .first_or_404())
    db.session.delete(entry)
    db.session.commit()
    return api_response({'message': '대화가 삭제되었습니다.'})
