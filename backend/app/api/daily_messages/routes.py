"""
일일 홈 메시지 API.
GET  /api/daily-messages/today     — 오늘 메시지 조회 (없으면 null)
POST /api/daily-messages/generate  — 즉시 생성 (테스트/수동)
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from zoneinfo import ZoneInfo

from app.extensions import db
from app.models.daily_message import DailyMessage
from app.models.user import User
from app.utils.helpers import api_response, api_error

daily_messages_bp = Blueprint('daily_messages', __name__, url_prefix='/api/daily-messages')
logger = logging.getLogger(__name__)


@daily_messages_bp.route('/today', methods=['GET'])
@jwt_required()
def get_today():
    """오늘 날짜(사용자 TZ 기준)의 메시지를 반환한다. 없으면 null."""
    user_id = get_jwt_identity()
    user = User.query.filter_by(id=user_id, deleted_at=None).first_or_404()

    tz = ZoneInfo(user.timezone or 'Asia/Seoul')
    today_local = datetime.now(tz).date()

    msg = DailyMessage.query.filter_by(
        user_id=user_id,
        message_date=today_local,
    ).first()

    return api_response({'message': msg.to_dict() if msg else None})


@daily_messages_bp.route('/generate', methods=['POST'])
@jwt_required()
def generate_now():
    """
    오늘 메시지를 즉시 생성한다 (테스트/수동 갱신용).
    이미 오늘 메시지가 있으면 기존 메시지를 반환한다.
    """
    user_id = get_jwt_identity()
    user = User.query.filter_by(id=user_id, deleted_at=None).first_or_404()

    tz = ZoneInfo(user.timezone or 'Asia/Seoul')
    today_local = datetime.now(tz).date()

    # 이미 존재하는 경우
    existing = DailyMessage.query.filter_by(
        user_id=user_id,
        message_date=today_local,
    ).first()
    if existing:
        return api_response({'message': existing.to_dict()})

    # 새로 생성
    from app.services.daily_message_service import generate_daily_message

    mood = (user.profile.ai_mood_default if user.profile else None) or 'empathy'
    try:
        content = generate_daily_message(user)
    except Exception as e:
        logger.error(f'일일 메시지 즉시 생성 실패 user={user_id}: {e}')
        return api_error('메시지 생성에 실패했습니다.', status=500)

    msg = DailyMessage(
        user_id=user_id,
        message_date=today_local,
        content=content,
        ai_mood_used=mood,
    )
    db.session.add(msg)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f'일일 메시지 저장 실패 user={user_id}: {e}')
        return api_error('메시지 저장에 실패했습니다.', status=500)

    return api_response({'message': msg.to_dict()}, status=201)
