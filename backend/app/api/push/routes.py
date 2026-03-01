"""
Web Push 구독 관리 API.
GET    /api/push/vapid-public-key  — VAPID 공개키
POST   /api/push/subscribe         — 구독 등록
DELETE /api/push/subscribe         — 구독 해제
"""
from __future__ import annotations
import logging

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, ValidationError

from app.extensions import db
from app.models.push_subscription import PushSubscription
from app.utils.helpers import api_response, api_error

push_bp = Blueprint('push', __name__, url_prefix='/api/push')
logger = logging.getLogger(__name__)


class SubscribeSchema(Schema):
    endpoint = fields.String(required=True)
    p256dh = fields.String(required=True)
    auth = fields.String(required=True)
    user_agent = fields.String(load_default=None, allow_none=True)


subscribe_schema = SubscribeSchema()


@push_bp.route('/vapid-public-key', methods=['GET'])
def get_vapid_public_key():
    """VAPID 공개키를 반환한다. (인증 불필요)"""
    key = current_app.config.get('VAPID_PUBLIC_KEY', '')
    if not key:
        return api_error('VAPID 공개키가 설정되지 않았습니다.', status=503)
    return api_response({'public_key': key})


@push_bp.route('/subscribe', methods=['POST'])
@jwt_required()
def subscribe():
    """푸시 구독을 등록한다."""
    user_id = get_jwt_identity()

    try:
        data = subscribe_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('유효하지 않은 구독 정보입니다.', errors=e.messages)

    # 기존 구독 업데이트 또는 신규 생성
    sub = PushSubscription.query.filter_by(endpoint=data['endpoint']).first()
    if sub:
        sub.user_id = user_id
        sub.p256dh = data['p256dh']
        sub.auth = data['auth']
        sub.user_agent = data.get('user_agent')
        sub.is_active = True
    else:
        sub = PushSubscription(
            user_id=user_id,
            endpoint=data['endpoint'],
            p256dh=data['p256dh'],
            auth=data['auth'],
            user_agent=data.get('user_agent'),
        )
        db.session.add(sub)

    db.session.commit()
    return api_response({'subscription': sub.to_dict()}, status=201)


@push_bp.route('/subscribe', methods=['DELETE'])
@jwt_required()
def unsubscribe():
    """푸시 구독을 해제한다."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    endpoint = data.get('endpoint')

    if endpoint:
        sub = PushSubscription.query.filter_by(endpoint=endpoint, user_id=user_id).first()
        if sub:
            db.session.delete(sub)
            db.session.commit()
    else:
        # 모든 구독 비활성화
        PushSubscription.query.filter_by(user_id=user_id).update({'is_active': False})
        db.session.commit()

    return api_response(message='구독이 해제되었습니다.')
