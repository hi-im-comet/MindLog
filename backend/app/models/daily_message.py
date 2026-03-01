"""
일일 홈 메시지 모델.
사용자 설정 시각에 하루 한 번 생성되는 AI 응원/조언 메시지.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone

from sqlalchemy import UniqueConstraint, Index

from app.extensions import db


class DailyMessage(db.Model):
    __tablename__ = 'daily_messages'

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
    )
    message_date = db.Column(db.Date, nullable=False)  # 사용자 TZ 기준 날짜
    content = db.Column(db.Text, nullable=False)
    generated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    ai_mood_used = db.Column(db.String(20), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint('user_id', 'message_date', name='uq_daily_message_user_date'),
        Index('ix_daily_message_user_date', 'user_id', 'message_date'),
    )

    def to_dict(self) -> dict:
        return {
            'id': str(self.id),
            'message_date': self.message_date.isoformat(),
            'content': self.content,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None,
            'ai_mood_used': self.ai_mood_used,
        }
