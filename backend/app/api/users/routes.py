from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError
from datetime import datetime, timezone

from app.extensions import db
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.journal_category import JournalCategory
from app.utils.helpers import api_response, api_error
from app.utils.constants import DEFAULT_CATEGORIES, RESPONSE_MODES

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


onboarding_schema = OnboardingSchema()
update_schema = UserUpdateSchema()


@users_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user = User.query.filter_by(id=user_id, deleted_at=None).first_or_404()
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

    # ai_name은 UserProfile에 저장
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
