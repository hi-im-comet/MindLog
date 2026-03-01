"""
체크인 리마인더 API.
GET/POST  /api/reminders
GET       /api/reminders/extract?entry_id=
GET/PATCH/DELETE /api/reminders/:id
POST      /api/reminders/:id/messages  (SSE 스트리밍)
"""
from __future__ import annotations
import json
import logging
from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, Response, stream_with_context
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError

from app.extensions import db
from app.models.check_in import CheckIn, VALID_STATUSES, VALID_TONES, VALID_RECURRENCES
from app.models.check_in_message import CheckInMessage
from app.utils.helpers import api_response, api_error

reminders_bp = Blueprint('reminders', __name__, url_prefix='/api/reminders')
logger = logging.getLogger(__name__)


# ─── Schemas ────────────────────────────────────────────────────────────────

class CreateCheckInSchema(Schema):
    title = fields.String(required=True, validate=validate.Length(min=1, max=200))
    scheduled_at = fields.DateTime(required=True, timezone=True)
    recurrence = fields.String(load_default='none', validate=validate.OneOf(VALID_RECURRENCES))
    tone = fields.String(load_default='encouraging', validate=validate.OneOf(VALID_TONES))
    source_entry_id = fields.UUID(load_default=None, allow_none=True)


class UpdateCheckInSchema(Schema):
    title = fields.String(validate=validate.Length(min=1, max=200))
    scheduled_at = fields.DateTime(timezone=True)
    recurrence = fields.String(validate=validate.OneOf(VALID_RECURRENCES))
    tone = fields.String(validate=validate.OneOf(VALID_TONES))
    status = fields.String(validate=validate.OneOf(VALID_STATUSES))
    snoozed_until = fields.DateTime(timezone=True, allow_none=True)


class SendMessageSchema(Schema):
    content = fields.String(required=True, validate=validate.Length(min=1, max=2000))
    action_type = fields.String(
        load_default=None, allow_none=True,
        validate=validate.OneOf(['done', 'snooze_10', 'snooze_60', 'reschedule', None])
    )


create_schema = CreateCheckInSchema()
update_schema = UpdateCheckInSchema()
message_schema = SendMessageSchema()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_check_in_or_404(check_in_id: str, user_id: str):
    check_in = CheckIn.query.filter_by(id=check_in_id, user_id=user_id).first()
    if not check_in:
        return None
    return check_in


def _apply_action(check_in: CheckIn, action_type: str | None):
    """quick action에 따라 check_in 상태를 변경한다."""
    now = datetime.now(timezone.utc)
    if action_type == 'done':
        check_in.status = 'done'
    elif action_type == 'snooze_10':
        check_in.status = 'snoozed'
        check_in.snoozed_until = now + timedelta(minutes=10)
        # 10분 후 재알림용 새 pending 생성
        _create_snoozed_check_in(check_in, timedelta(minutes=10))
    elif action_type == 'snooze_60':
        check_in.status = 'snoozed'
        check_in.snoozed_until = now + timedelta(hours=1)
        _create_snoozed_check_in(check_in, timedelta(hours=1))


def _create_snoozed_check_in(source: CheckIn, delta: timedelta):
    """스누즈 후 재알림을 위한 새 pending 체크인을 생성한다."""
    now = datetime.now(timezone.utc)
    new_ci = CheckIn(
        user_id=source.user_id,
        title=source.title,
        scheduled_at=now + delta,
        recurrence='none',
        tone=source.tone,
        status='pending',
        source_entry_id=source.source_entry_id,
    )
    db.session.add(new_ci)


# ─── Routes ──────────────────────────────────────────────────────────────────

@reminders_bp.route('', methods=['GET'])
@jwt_required()
def list_check_ins():
    user_id = get_jwt_identity()
    status_filter = request.args.get('status')

    q = CheckIn.query.filter_by(user_id=user_id)
    if status_filter and status_filter in VALID_STATUSES:
        q = q.filter_by(status=status_filter)

    check_ins = q.order_by(CheckIn.scheduled_at.desc()).all()
    return api_response({'check_ins': [c.to_dict() for c in check_ins]})


@reminders_bp.route('', methods=['POST'])
@jwt_required()
def create_check_in():
    user_id = get_jwt_identity()
    try:
        data = create_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('유효하지 않은 요청입니다.', errors=e.messages)

    check_in = CheckIn(
        user_id=user_id,
        title=data['title'],
        scheduled_at=data['scheduled_at'],
        recurrence=data.get('recurrence', 'none'),
        tone=data.get('tone', 'encouraging'),
        source_entry_id=data.get('source_entry_id'),
    )
    db.session.add(check_in)
    db.session.commit()
    return api_response({'check_in': check_in.to_dict()}, status=201)


@reminders_bp.route('/extract', methods=['GET'])
@jwt_required()
def extract_tasks():
    """일기 텍스트에서 할 일을 NLP로 추출한다."""
    user_id = get_jwt_identity()
    entry_id = request.args.get('entry_id')
    if not entry_id:
        return api_error('entry_id가 필요합니다.')

    from app.models.journal_entry import JournalEntry
    entry = JournalEntry.query.filter_by(id=entry_id, user_id=user_id).first()
    if not entry:
        return api_error('일기를 찾을 수 없습니다.', status=404)

    from app.services.nlp_task_extractor import extract_tasks as nlp_extract
    tasks = nlp_extract(entry.raw_content or '')
    return api_response({'tasks': tasks})


@reminders_bp.route('/<string:check_in_id>', methods=['GET'])
@jwt_required()
def get_check_in(check_in_id: str):
    user_id = get_jwt_identity()
    check_in = _get_check_in_or_404(check_in_id, user_id)
    if not check_in:
        return api_error('체크인을 찾을 수 없습니다.', status=404)
    return api_response({'check_in': check_in.to_dict(include_messages=True)})


@reminders_bp.route('/<string:check_in_id>', methods=['PATCH'])
@jwt_required()
def update_check_in(check_in_id: str):
    user_id = get_jwt_identity()
    check_in = _get_check_in_or_404(check_in_id, user_id)
    if not check_in:
        return api_error('체크인을 찾을 수 없습니다.', status=404)

    try:
        data = update_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('유효하지 않은 요청입니다.', errors=e.messages)

    for field in ('title', 'scheduled_at', 'recurrence', 'tone', 'status', 'snoozed_until'):
        if field in data:
            setattr(check_in, field, data[field])

    check_in.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return api_response({'check_in': check_in.to_dict()})


@reminders_bp.route('/<string:check_in_id>', methods=['DELETE'])
@jwt_required()
def delete_check_in(check_in_id: str):
    user_id = get_jwt_identity()
    check_in = _get_check_in_or_404(check_in_id, user_id)
    if not check_in:
        return api_error('체크인을 찾을 수 없습니다.', status=404)

    db.session.delete(check_in)
    db.session.commit()
    return api_response(message='삭제되었습니다.')


@reminders_bp.route('/<string:check_in_id>/messages', methods=['POST'])
@jwt_required()
def send_message(check_in_id: str):
    """SSE 스트리밍으로 체크인 대화 메시지를 처리한다."""
    user_id = get_jwt_identity()
    check_in = _get_check_in_or_404(check_in_id, user_id)
    if not check_in:
        return api_error('체크인을 찾을 수 없습니다.', status=404)

    try:
        data = message_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('유효하지 않은 요청입니다.', errors=e.messages)

    content = data['content']
    action_type = data.get('action_type')

    def generate():
        # 사용자 메시지 저장
        user_msg = CheckInMessage(
            check_in_id=check_in.id,
            role='user',
            content=content,
            action_type=action_type,
        )
        db.session.add(user_msg)

        # 액션 처리
        if action_type:
            _apply_action(check_in, action_type)

        check_in.updated_at = datetime.now(timezone.utc)

        try:
            db.session.commit()
        except Exception as e:
            logger.error(f'메시지 저장 실패: {e}')
            db.session.rollback()
            yield f'data: {json.dumps({"type": "error", "message": "메시지 저장에 실패했습니다."})}\n\n'
            return

        # AI 응답 생성 (check_in_ai 사용 — Haiku, non-streaming)
        from app.services.check_in_ai import build_ai_response
        try:
            ai_content = build_ai_response(check_in, content, action_type)
        except Exception as e:
            logger.error(f'AI 응답 생성 실패: {e}')
            ai_content = '잠시 후 다시 시도해 주세요.'

        # chunk 이벤트 (단일 청크로 전송)
        yield f'data: {json.dumps({"type": "chunk", "content": ai_content})}\n\n'

        # AI 메시지 저장
        ai_msg = CheckInMessage(
            check_in_id=check_in.id,
            role='ai',
            content=ai_content,
            model_used='claude-haiku-4-5-20251001',
        )
        db.session.add(ai_msg)

        try:
            db.session.commit()
        except Exception as e:
            logger.error(f'AI 메시지 저장 실패: {e}')
            db.session.rollback()

        # done 이벤트
        yield f'data: {json.dumps({"type": "done", "message": ai_msg.to_dict()})}\n\n'

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        },
    )
