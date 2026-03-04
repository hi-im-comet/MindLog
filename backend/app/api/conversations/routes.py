"""
AI 대화 엔드포인트 고도화.
POST /api/conversations              — 대화 시작 (or 기존 대화 반환)
GET  /api/conversations/:id          — 대화 + 메시지 목록
PATCH /api/conversations/:id         — response_mode 변경
DELETE /api/conversations/:id        — 대화 전체 삭제 (기록 삭제 시 연동)
POST /api/conversations/:id/messages — 메시지 전송 (SSE 스트리밍)
DELETE /api/conversations/messages/:id — 개별 메시지 삭제
"""
from __future__ import annotations
import json
import logging
from flask import Blueprint, request, Response, stream_with_context
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError

from app.extensions import db
from app.models.conversation import Conversation, VALID_RESPONSE_MODES
from app.models.conversation_message import ConversationMessage
from app.models.journal_entry import JournalEntry
from app.models.user_profile import UserProfile
from app.services.ai_service import stream_claude, MODEL_SONNET
from app.services.crisis_detector import detect_crisis, get_crisis_resource_message
from app.services.prompt_builder import build_conversation_system_prompt, build_chat_opener_system
from app.utils.helpers import api_response, api_error

conversations_bp = Blueprint('conversations', __name__, url_prefix='/api/conversations')
logger = logging.getLogger(__name__)


# ─── Schemas ────────────────────────────────────────────────────────────────

class StartConversationSchema(Schema):
    entry_id = fields.UUID(required=True)
    response_mode = fields.String(
        load_default='empathetic',
        validate=validate.OneOf(VALID_RESPONSE_MODES),
    )


class UpdateModeSchema(Schema):
    response_mode = fields.String(required=True, validate=validate.OneOf(VALID_RESPONSE_MODES))


class SendMessageSchema(Schema):
    content = fields.String(required=True, validate=validate.Length(min=1, max=5000))


start_schema = StartConversationSchema()
update_schema = UpdateModeSchema()
message_schema = SendMessageSchema()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _build_system_prompt_with_entry(conv: Conversation, entry: JournalEntry, user_id: str,
                                    response_length: str = 'normal') -> str:
    """시스템 프롬프트에 일기 원문 + AI 추출 데이터 + 최근 요약을 포함한다."""
    from app.models.user import User
    profile = UserProfile.query.filter_by(user_id=user_id).first()
    user_profile_dict = profile.to_dict() if profile else None
    categories = [c.name for c in (entry.categories or [])]
    user = User.query.filter_by(id=user_id).first()
    user_name = user.display_name if user else None
    ai_name = profile.ai_name if profile else None

    system_prompt = build_conversation_system_prompt(
        user_profile=user_profile_dict,
        response_mode=conv.response_mode,
        entry_date=str(entry.entry_date),
        categories=categories,
        user_name=user_name,
        ai_name=ai_name,
        response_length=response_length,
    )

    system_prompt += f'\n\n【오늘 일기 원문】\n{entry.raw_content}'

    extraction = entry.ai_extraction
    if extraction:
        mood_kws = extraction.mood_keywords or []
        stress = extraction.stress_indicators or []
        if mood_kws:
            system_prompt += f'\n[AI 분석 - 감정 키워드] {", ".join(mood_kws)}'
        if stress:
            system_prompt += f'\n[AI 분석 - 스트레스 징후] {", ".join(stress)}'

    recent_entries = (
        JournalEntry.query
        .filter_by(user_id=user_id)
        .filter(JournalEntry.daily_summary.isnot(None))
        .filter(JournalEntry.id != entry.id)
        .order_by(JournalEntry.entry_date.desc())
        .limit(5)
        .all()
    )
    recent_summaries = [e.daily_summary for e in recent_entries if e.daily_summary]
    if recent_summaries:
        system_prompt += (
            f'\n\n[최근 {len(recent_summaries)}일 요약]\n'
            + '\n'.join(f'- {s}' for s in recent_summaries)
        )

    return system_prompt


def _sse_line(data: dict) -> str:
    return f'data: {json.dumps(data, ensure_ascii=False)}\n\n'


# ─── Routes ──────────────────────────────────────────────────────────────────

@conversations_bp.route('', methods=['POST'])
@jwt_required()
def start_or_get_conversation():
    """대화 시작: 일기에 대한 대화 스레드를 생성하거나 기존 것을 반환."""
    user_id = get_jwt_identity()
    try:
        data = start_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('입력값을 확인해주세요.', 422, e.messages)

    entry_id = str(data['entry_id'])
    entry = (
        JournalEntry.query
        .filter_by(id=entry_id, user_id=user_id)
        .filter(JournalEntry.deleted_at.is_(None))
        .first_or_404()
    )

    profile = UserProfile.query.filter_by(user_id=user_id).first()
    effective_mode = (
        entry.ai_mood_override
        or (profile.ai_mood_default if profile else None)
        or 'empathy'
    )

    existing = Conversation.query.filter_by(entry_id=entry_id).first()
    if existing:
        # 클라이언트가 명시적으로 mode를 보낸 경우에만 업데이트
        requested_mode = request.get_json(silent=True) or {}
        if 'response_mode' in requested_mode:
            new_mode = data.get('response_mode', existing.response_mode)
            if new_mode != existing.response_mode:
                existing.response_mode = new_mode
                db.session.commit()
        return api_response({'conversation': existing.to_dict(include_messages=True)})

    conv = Conversation(
        entry_id=entry_id,
        user_id=user_id,
        response_mode=effective_mode,
    )
    db.session.add(conv)
    db.session.flush()

    try:
        from app.services.ai_service import call_claude, MODEL_HAIKU
        from app.models.user import User as _User
        _user = _User.query.filter_by(id=user_id).first()
        _profile = UserProfile.query.filter_by(user_id=user_id).first()
        opener_system = build_chat_opener_system(
            user_name=_user.display_name if _user else None,
            ai_name=_profile.ai_name if _profile else None,
        )
        opener_text, _ = call_claude(
            messages=[{'role': 'user', 'content': '안녕'}],
            system_prompt=opener_system,
            model=MODEL_HAIKU,
            max_tokens=200,
        )
        db.session.add(ConversationMessage(
            conversation_id=str(conv.id),
            role='assistant',
            content=opener_text,
        ))
    except Exception as e:
        logger.warning(f'opener 생성 실패: {e}')

    db.session.commit()
    return api_response({'conversation': conv.to_dict(include_messages=True)}, status=201)


@conversations_bp.route('/<uuid:conv_id>', methods=['GET'])
@jwt_required()
def get_conversation(conv_id):
    user_id = get_jwt_identity()
    conv = (
        Conversation.query
        .filter_by(id=conv_id, user_id=user_id)
        .first_or_404()
    )
    return api_response({'conversation': conv.to_dict(include_messages=True)})


@conversations_bp.route('/<uuid:conv_id>', methods=['PATCH'])
@jwt_required()
def update_conversation(conv_id):
    user_id = get_jwt_identity()
    conv = (
        Conversation.query
        .filter_by(id=conv_id, user_id=user_id)
        .first_or_404()
    )
    try:
        data = update_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('입력값을 확인해주세요.', 422, e.messages)

    conv.response_mode = data['response_mode']
    db.session.commit()
    return api_response({'conversation': conv.to_dict()})


@conversations_bp.route('/<uuid:conv_id>', methods=['DELETE'])
@jwt_required()
def delete_conversation(conv_id):
    """대화 전체 삭제 (메시지도 연쇄 삭제됨)"""
    user_id = get_jwt_identity()
    conv = Conversation.query.filter_by(id=str(conv_id), user_id=user_id).first_or_404()
    
    db.session.delete(conv)
    db.session.commit()
    return api_response({'message': '대화 기록이 모두 삭제되었습니다.'})


@conversations_bp.route('/messages/<uuid:message_id>', methods=['DELETE'])
@jwt_required()
def delete_message(message_id):
    """개별 채팅 메시지 삭제"""
    user_id = get_jwt_identity()
    message = ConversationMessage.query.filter_by(id=str(message_id)).first_or_404()

    if message.conversation.user_id != user_id:
        return api_error('삭제 권한이 없습니다.', 403)

    db.session.delete(message)
    db.session.commit()
    return api_response({'message': '메시지가 삭제되었습니다.'})


@conversations_bp.route('/<uuid:conv_id>/messages', methods=['POST'])
@jwt_required()
def send_message(conv_id):
    """메시지를 전송하고 SSE 스트림으로 AI 응답을 반환한다."""
    user_id = get_jwt_identity()
    conv = (
        Conversation.query
        .filter_by(id=conv_id, user_id=user_id)
        .first_or_404()
    )

    try:
        data = message_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('입력값을 확인해주세요.', 422, e.messages)

    user_content = data['content']

    crisis_detected, crisis_keywords = detect_crisis(user_content)

    user_msg = ConversationMessage(
        conversation_id=str(conv.id),
        role='user',
        content=user_content,
        crisis_flag=crisis_detected,
        crisis_keywords=crisis_keywords,
    )
    db.session.add(user_msg)
    db.session.commit()

    entry = conv.entry
    try:
        _profile = UserProfile.query.filter_by(user_id=user_id).first()
        effective_length = (
            entry.ai_response_length_override
            or (_profile.ai_response_length_default if _profile else None)
            or 'normal'
        )
        system_prompt = _build_system_prompt_with_entry(conv, entry, user_id,
                                                        response_length=effective_length)
    except Exception as e:
        logger.error(f'시스템 프롬프트 조립 실패: {e}')
        system_prompt = 'You are a supportive journaling companion. Listen and respond warmly.'

    all_msgs = conv.messages
    messages = [{'role': m.role, 'content': m.content} for m in all_msgs]

    if crisis_detected:
        crisis_content = get_crisis_resource_message()
        assistant_msg = ConversationMessage(
            conversation_id=str(conv.id),
            role='assistant',
            content=crisis_content,
            crisis_flag=True,
        )
        db.session.add(assistant_msg)
        db.session.commit()

        def crisis_stream():
            yield _sse_line({'type': 'crisis', 'content': crisis_content})
            yield _sse_line({'type': 'done', 'message': assistant_msg.to_dict(), 'user_message_id': str(user_msg.id)})

        return Response(
            stream_with_context(crisis_stream()),
            mimetype='text/event-stream',
            headers={'X-Accel-Buffering': 'no', 'Cache-Control': 'no-cache'},
        )

    def generate():
        full_response: list[str] = []
        try:
            for chunk in stream_claude(messages=messages, system_prompt=system_prompt):
                full_response.append(chunk)
                yield _sse_line({'type': 'chunk', 'content': chunk})

            full_text = ''.join(full_response)
            assistant_msg = ConversationMessage(
                conversation_id=str(conv.id),
                role='assistant',
                content=full_text,
                model_used=MODEL_SONNET,
            )
            db.session.add(assistant_msg)
            db.session.commit()
            yield _sse_line({'type': 'done', 'message': assistant_msg.to_dict(), 'user_message_id': str(user_msg.id)})

        except Exception as e:
            logger.error(f'SSE 스트리밍 오류: {e}')
            # AI 응답 저장 실패 시 이미 커밋된 user_msg도 삭제해 고아 메시지 방지
            try:
                db.session.delete(user_msg)
                db.session.commit()
            except Exception:
                db.session.rollback()
            yield _sse_line({'type': 'error', 'message': 'AI 응답 중 오류가 발생했습니다.'})

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={'X-Accel-Buffering': 'no', 'Cache-Control': 'no-cache'},
    )