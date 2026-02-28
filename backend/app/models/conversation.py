import uuid
from datetime import datetime, timezone
from app.extensions import db

VALID_RESPONSE_MODES = (
    'empathy', 'advice', 'reflection', 'friend', 'objective',
    'empathetic', 'pattern_recognition',  # 레거시 backward compat
)


class Conversation(db.Model):
    __tablename__ = 'conversations'

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey('journal_entries.id', ondelete='CASCADE'),
                          unique=True, nullable=False)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'),
                         nullable=False, index=True)
    response_mode = db.Column(db.String(50), nullable=False, default='empathetic')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                            onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    entry = db.relationship('JournalEntry', back_populates='conversation')
    user = db.relationship('User', back_populates='conversations')
    messages = db.relationship('ConversationMessage', back_populates='conversation',
                                order_by='ConversationMessage.created_at',
                                cascade='all, delete-orphan')

    def to_dict(self, include_messages=False):
        data = {
            'id': str(self.id),
            'entry_id': str(self.entry_id),
            'response_mode': self.response_mode,
            'is_active': self.is_active,
            'message_count': len(self.messages) if self.messages else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_messages:
            data['messages'] = [m.to_dict() for m in (self.messages or [])]
        return data

    def __repr__(self):
        return f'<Conversation entry_id={self.entry_id}>'
