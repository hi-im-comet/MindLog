import uuid
from datetime import datetime, timezone
from app.extensions import db


class ConversationMessage(db.Model):
    __tablename__ = 'conversation_messages'

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = db.Column(db.UUID(as_uuid=True),
                                 db.ForeignKey('conversations.id', ondelete='CASCADE'),
                                 nullable=False, index=True)
    role = db.Column(db.String(20), nullable=False)  # 'user' | 'assistant'
    content = db.Column(db.Text, nullable=False)
    token_count = db.Column(db.Integer, nullable=True)
    model_used = db.Column(db.String(100), nullable=True)
    crisis_flag = db.Column(db.Boolean, default=False)
    crisis_keywords = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    conversation = db.relationship('Conversation', back_populates='messages')

    def to_dict(self):
        return {
            'id': str(self.id),
            'role': self.role,
            'content': self.content,
            'crisis_flag': self.crisis_flag,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<ConversationMessage {self.role}>'
