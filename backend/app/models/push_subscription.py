import uuid
from datetime import datetime, timezone
from app.extensions import db


class PushSubscription(db.Model):
    __tablename__ = 'push_subscriptions'

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True),
                        db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    endpoint = db.Column(db.Text, nullable=False, unique=True)
    p256dh = db.Column(db.Text, nullable=False)
    auth = db.Column(db.Text, nullable=False)
    user_agent = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_used_at = db.Column(db.DateTime(timezone=True), nullable=True)

    def to_dict(self):
        return {
            'id': str(self.id),
            'endpoint': self.endpoint,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_used_at': self.last_used_at.isoformat() if self.last_used_at else None,
        }

    def __repr__(self):
        return f'<PushSubscription {self.id} user={self.user_id}>'
