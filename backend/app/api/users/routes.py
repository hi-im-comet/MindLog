from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone

from app.extensions import db
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.journal_category import JournalCategory
from app.utils.helpers import api_response, api_error
from app.utils.constants import DEFAULT_CATEGORIES, RESPONSE_MODES
from app.utils.timezone_utils import recompute_streak_from_entries

users_bp = Blueprint('users', __name__, url_prefix='/api/users')


class OnboardingSchema(Schema):
    selected_categories = fields.List(fields.String(), load_default=None)
    preferred_response_mode = fields.String(
        load_default='empathetic',
        validate=validate.OneOf(RESPONSE_MODES),
    )


class UserUpdateSchema(Schema):
    display_name = fields.String(validate=validate.Length(min=1, max=100))
    timezone = fields.String(validate=validate.Length(max=50))
    ai_name = fields.String(allow_none=True, validate=validate.Length(max=50))
    # entry_lock_enabled은 setup-lock / disable-lock 전용 엔드포인트로만 변경 가능


onboarding_schema = OnboardingSchema()
update_schema = UserUpdateSchema()


@users_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user = User.query.filter_by(id=user_id, deleted_at=None).first_or_404()
    # streak는 KST 기준 실제 기록에서 매번 재계산해 새로고침/재로그인 시에도 동일하게 표시
    if user.profile:
        try:
            consecutive_days, last_entry_date = recompute_streak_from_entries(user_id, db.session)
            user.profile.consecutive_days = consecutive_days
            user.profile.last_entry_date = last_entry_date
            db.session.commit()
        except Exception:
            db.session.rollback()
    return api_response({'user': user.to_dict(include_profile=True)})


@users_bp.route('/me', methods=['PATCH'])
@jwt_required()
def update_me():
    user_id = get_jwt_identity()
    user = User.query.filter_by(id=user_id, deleted_at=None).first_or_404()

    try:
        data = update_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('입력값을 확인해주세요.', 422, e.messages)

    # 프로필 전용 필드 분리
    ai_name = data.pop('ai_name', ...)  # ... = field not provided

    for key, value in data.items():
        setattr(user, key, value)

    if ai_name is not ...:
        if user.profile:
            user.profile.ai_name = ai_name or None
        else:
            profile = UserProfile(user_id=user_id, ai_name=ai_name or None)
            db.session.add(profile)

    db.session.commit()
    return api_response({'user': user.to_dict(include_profile=True)})


@users_bp.route('/me/onboarding', methods=['POST'])
@jwt_required()
def complete_onboarding():
    user_id = get_jwt_identity()
    user = User.query.filter_by(id=user_id, deleted_at=None).first_or_404()

    try:
        data = onboarding_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('입력값을 확인해주세요.', 422, e.messages)

    # Add any extra categories the user selected that aren't in defaults
    existing_names = {c.name for c in user.categories}
    selected = data.get('selected_categories') or []
    default_names = {c['name'] for c in DEFAULT_CATEGORIES}

    for name in selected:
        if name not in existing_names and name not in default_names:
            cat = JournalCategory(user_id=user_id, name=name)
            db.session.add(cat)

    # Deactivate default categories that user didn't select
    if selected:
        for cat in user.categories:
            if cat.is_default and cat.name not in selected:
                cat.is_active = False
            elif cat.is_default and cat.name in selected:
                cat.is_active = True

    # Update profile preference
    if user.profile:
        user.profile.preferred_response_mode = data['preferred_response_mode']
    else:
        profile = UserProfile(
            user_id=user_id,
            preferred_response_mode=data['preferred_response_mode'],
        )
        db.session.add(profile)

    user.onboarding_completed = True
    db.session.commit()

    active_cats = JournalCategory.query.filter_by(user_id=user_id, is_active=True).all()
    return api_response({
        'onboarding_completed': True,
        'categories': [c.to_dict() for c in active_cats],
    })


@users_bp.route('/me/setup-lock', methods=['POST'])
@jwt_required()
def setup_lock():
    """잠금 기능 활성화: 전역 비밀번호 설정 후 entry_lock_enabled = True."""
    user_id = get_jwt_identity()
    user = User.query.filter_by(id=user_id, deleted_at=None).first_or_404()
    body = request.get_json(silent=True) or {}
    password = body.get('password', '')

    if not password or len(password) < 4:
        return api_error('비밀번호는 4자 이상이어야 해요.', 400)

    if not user.profile:
        user.profile = UserProfile(user_id=user_id)
        db.session.add(user.profile)

    user.profile.lock_password_hash = generate_password_hash(password)
    user.profile.entry_lock_enabled = True
    db.session.commit()
    return api_response({'user': user.to_dict(include_profile=True)})


@users_bp.route('/me/disable-lock', methods=['POST'])
@jwt_required()
def disable_lock():
    """잠금 기능 비활성화: 비밀번호 확인 후 entry_lock_enabled = False.
    clear_entries=True이면 모든 일기의 is_locked도 False로 초기화."""
    from app.models.journal_entry import JournalEntry

    user_id = get_jwt_identity()
    user = User.query.filter_by(id=user_id, deleted_at=None).first_or_404()
    body = request.get_json(silent=True) or {}
    password = body.get('password', '')
    clear_entries = body.get('clear_entries', True)

    if not user.profile or not user.profile.entry_lock_enabled:
        return api_error('잠금 기능이 활성화되어 있지 않아요.', 400)

    if not user.profile.lock_password_hash or \
       not check_password_hash(user.profile.lock_password_hash, password):
        return api_error('비밀번호가 일치하지 않아요.', 401)

    user.profile.entry_lock_enabled = False
    user.profile.lock_password_hash = None

    if clear_entries:
        JournalEntry.query.filter_by(user_id=user_id).update({'is_locked': False})

    db.session.commit()
    return api_response({'user': user.to_dict(include_profile=True)})


@users_bp.route('/me/change-lock-password', methods=['POST'])
@jwt_required()
def change_lock_password():
    """잠금 비밀번호 변경: 기존 비밀번호 확인 후 새 비밀번호 설정."""
    user_id = get_jwt_identity()
    user = User.query.filter_by(id=user_id, deleted_at=None).first_or_404()
    body = request.get_json(silent=True) or {}
    current_password = body.get('current_password', '')
    new_password = body.get('new_password', '')

    if not user.profile or not user.profile.entry_lock_enabled:
        return api_error('잠금 기능이 활성화되어 있지 않아요.', 400)

    if not new_password or len(new_password) < 4:
        return api_error('새 비밀번호는 4자 이상이어야 해요.', 400)

    if user.profile.lock_password_hash:
        if not check_password_hash(user.profile.lock_password_hash, current_password):
            return api_error('현재 비밀번호가 일치하지 않아요.', 401)

    user.profile.lock_password_hash = generate_password_hash(new_password)
    db.session.commit()
    return api_response({'user': user.to_dict(include_profile=True)})


@users_bp.route('/me/verify-lock', methods=['POST'])
@jwt_required()
def verify_lock():
    """전역 잠금 비밀번호 검증 (잠긴 일기 열람 시)."""
    user_id = get_jwt_identity()
    user = User.query.filter_by(id=user_id, deleted_at=None).first_or_404()
    body = request.get_json(silent=True) or {}
    password = body.get('password', '')

    if not user.profile or not user.profile.entry_lock_enabled:
        return api_error('잠금 기능이 활성화되어 있지 않아요.', 400)

    if not user.profile.lock_password_hash:
        return api_error('설정된 비밀번호가 없어요.', 400)

    verified = check_password_hash(user.profile.lock_password_hash, password)
    if not verified:
        return api_error('비밀번호가 일치하지 않아요.', 401)

    return api_response({'verified': True})


@users_bp.route('/me', methods=['DELETE'])
@jwt_required()
def delete_me():
    """계정 및 모든 데이터 완전 삭제 (Hard Delete). DB CASCADE로 연관 데이터 자동 삭제."""
    user_id = get_jwt_identity()
    user = User.query.filter_by(id=user_id).first_or_404()
    db.session.delete(user)
    db.session.commit()
    return api_response({'message': '계정과 모든 데이터가 완전히 삭제되었습니다.'})


@users_bp.route('/me/export', methods=['GET'])
@jwt_required()
def export_me():
    """사용자 데이터 전체 내보내기."""
    from app.models.journal_entry import JournalEntry
    from app.models.pattern_log import PatternLog

    user_id = get_jwt_identity()
    user = User.query.filter_by(id=user_id).first_or_404()

    entries = (JournalEntry.query
               .filter_by(user_id=user_id)
               .filter(JournalEntry.deleted_at.is_(None))
               .order_by(JournalEntry.entry_date.desc())
               .all())
    patterns = (PatternLog.query
                .filter_by(user_id=user_id)
                .order_by(PatternLog.generated_at.desc())
                .all())

    export = {
        'exported_at': datetime.now(timezone.utc).isoformat(),
        'user': {
            'display_name': user.display_name,
            'email': user.email,
            'created_at': user.created_at.isoformat() if user.created_at else None,
        },
        'entries': [e.to_dict(full=True) for e in entries],
        'patterns': [p.to_dict() for p in patterns],
    }
    return api_response({'export': export})
