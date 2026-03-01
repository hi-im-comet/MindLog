import uuid
from datetime import datetime, timezone
from app.extensions import db


class CheckInMessage(db.Model):
    __tablename__ = 'check_in_messages'

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    check_in_id = db.Column(db.UUID(as_uuid=True),
                            db.ForeignKey('check_ins.id', ondelete='CASCADE'), nullable=False)
    role = db.Column(db.String(10), nullable=False)  # 'ai' | 'user'
    content = db.Column(db.Text, nullable=False)
    action_type = db.Column(db.String(20), nullable=True)  # 'done','snooze_10','snooze_60','reschedule'
    model_used = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': str(self.id),
            'check_in_id': str(self.check_in_id),
            'role': self.role,
            'content': self.content,
            'action_type': self.action_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<CheckInMessage {self.id} role={self.role}>'
