from flask import Blueprint, request
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt,
)
from marshmallow import ValidationError

from app.extensions import db
from app.models.user import User
from app.models.user_profile import UserProfile
from app.api.auth.schemas import RegisterSchema, LoginSchema, GoogleAuthSchema, RefreshSchema
from app.services import auth_service
from app.utils.helpers import api_response, api_error, get_client_ip, get_user_agent

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

register_schema = RegisterSchema()
login_schema = LoginSchema()
google_schema = GoogleAuthSchema()
refresh_schema = RefreshSchema()


@auth_bp.route('/register', methods=['POST'])
def register():
    body = request.get_json()
    if not body:
        return api_error('요청 본문이 비어 있습니다.', 400)
    try:
        data = register_schema.load(body)
    except ValidationError as e:
        msg = e.messages
        if isinstance(msg, dict):
            first = next((v[0] if isinstance(v, list) else v for v in msg.values() if v), '입력값을 확인해주세요.')
        else:
            first = msg if isinstance(msg, str) else '입력값을 확인해주세요.'
        return api_error(first, 400, e.messages if isinstance(msg, dict) else None)

    if User.query.filter_by(email=data['email']).first():
        return api_error('이미 사용 중인 이메일입니다.', 409)

    user = auth_service.create_user_with_profile(
        email=data['email'],
        display_name=data['userNickname'],
        password=data['password'],
        ai_nickname=data['aiNickname'],
    )
    auth_service.seed_default_categories(user.id)

    access_token = create_access_token(identity=str(user.id))
    raw_refresh = create_refresh_token(identity=str(user.id))

    from flask import current_app
    auth_service.store_refresh_token(
        user.id, raw_refresh,
        current_app.config['JWT_REFRESH_TOKEN_EXPIRES'],
    )
    auth_service.log_audit(user.id, 'register', get_client_ip(), get_user_agent())
    db.session.commit()

    return api_response({
        'user': user.to_dict(include_profile=True),
        'access_token': access_token,
        'refresh_token': raw_refresh,
    }, status=201)


@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = login_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('입력값을 확인해주세요.', 422, e.messages)

    user = User.query.filter_by(email=data['email'], deleted_at=None).first()
    if not user or not user.password_hash:
        return api_error('이메일 또는 비밀번호가 올바르지 않습니다.', 401)

    if not auth_service.check_password(data['password'], user.password_hash):
        auth_service.log_audit(user.id, 'login_failed', get_client_ip(), get_user_agent())
        db.session.commit()
        return api_error('이메일 또는 비밀번호가 올바르지 않습니다.', 401)

    access_token = create_access_token(identity=str(user.id))
    raw_refresh = create_refresh_token(identity=str(user.id))

    from flask import current_app
    auth_service.store_refresh_token(
        user.id, raw_refresh,
        current_app.config['JWT_REFRESH_TOKEN_EXPIRES'],
    )
    auth_service.log_audit(user.id, 'login', get_client_ip(), get_user_agent())
    db.session.commit()

    return api_response({
        'user': user.to_dict(include_profile=True),
        'access_token': access_token,
        'refresh_token': raw_refresh,
    })


@auth_bp.route('/google', methods=['POST'])
def google_auth():
    try:
        data = google_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('입력값을 확인해주세요.', 422, e.messages)

    try:
        idinfo = auth_service.verify_google_id_token(data['credential'])
    except Exception:
        return api_error('Google 인증에 실패했습니다.', 401)

    google_id = idinfo['sub']
    email = idinfo.get('email', '')
    display_name = idinfo.get('name', email.split('@')[0])
    avatar_url = idinfo.get('picture')

    user = User.query.filter_by(google_id=google_id).first()
    is_new = False

    if not user:
        # Check if email already exists (link accounts)
        user = User.query.filter_by(email=email, deleted_at=None).first()
        if user:
            user.google_id = google_id
            if avatar_url and not user.avatar_url:
                user.avatar_url = avatar_url
        else:
            user = auth_service.create_user_with_profile(
                email=email,
                display_name=display_name,
                google_id=google_id,
                avatar_url=avatar_url,
            )
            auth_service.seed_default_categories(user.id)
            is_new = True

    access_token = create_access_token(identity=str(user.id))
    raw_refresh = create_refresh_token(identity=str(user.id))

    from flask import current_app
    auth_service.store_refresh_token(
        user.id, raw_refresh,
        current_app.config['JWT_REFRESH_TOKEN_EXPIRES'],
    )
    auth_service.log_audit(user.id, 'google_login', get_client_ip(), get_user_agent())
    db.session.commit()

    return api_response({
        'user': user.to_dict(include_profile=True),
        'access_token': access_token,
        'refresh_token': raw_refresh,
        'is_new_user': is_new,
    }, status=201 if is_new else 200)


@auth_bp.route('/refresh', methods=['POST'])
def refresh():
    try:
        data = refresh_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('입력값을 확인해주세요.', 422, e.messages)

    token_record = auth_service.validate_refresh_token(data['refresh_token'])
    if not token_record:
        return api_error('유효하지 않거나 만료된 토큰입니다.', 401)

    access_token = create_access_token(identity=str(token_record.user_id))
    return api_response({'access_token': access_token})


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    body = request.get_json() or {}
    raw_refresh = body.get('refresh_token')
    if raw_refresh:
        auth_service.revoke_refresh_token(raw_refresh)

    user_id = get_jwt_identity()
    auth_service.log_audit(user_id, 'logout', get_client_ip(), get_user_agent())
    db.session.commit()

    return api_response({'message': '로그아웃되었습니다.'})
