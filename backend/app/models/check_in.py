import uuid
from datetime import datetime, timezone
from app.extensions import db

VALID_STATUSES = ('pending', 'sent', 'done', 'snoozed', 'cancelled')
VALID_TONES = ('encouraging', 'gentle', 'strict')
VALID_RECURRENCES = ('none', 'daily', 'weekly')


class CheckIn(db.Model):
    __tablename__ = 'check_ins'

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    scheduled_at = db.Column(db.DateTime(timezone=True), nullable=False)
    recurrence = db.Column(db.String(10), nullable=False, default='none')
    tone = db.Column(db.String(20), nullable=False, default='encouraging')
    status = db.Column(db.String(20), nullable=False, default='pending')
    source_entry_id = db.Column(db.UUID(as_uuid=True),
                                db.ForeignKey('journal_entries.id', ondelete='SET NULL'), nullable=True)
    notification_sent_at = db.Column(db.DateTime(timezone=True), nullable=True)
    followup_sent_at = db.Column(db.DateTime(timezone=True), nullable=True)
    snoozed_until = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    messages = db.relationship('CheckInMessage', backref='check_in', lazy='dynamic',
                               cascade='all, delete-orphan', order_by='CheckInMessage.created_at')

    def to_dict(self, include_messages=False):
        data = {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'title': self.title,
            'scheduled_at': self.scheduled_at.isoformat() if self.scheduled_at else None,
            'recurrence': self.recurrence,
            'tone': self.tone,
            'status': self.status,
            'source_entry_id': str(self.source_entry_id) if self.source_entry_id else None,
            'notification_sent_at': self.notification_sent_at.isoformat() if self.notification_sent_at else None,
            'followup_sent_at': self.followup_sent_at.isoformat() if self.followup_sent_at else None,
            'snoozed_until': self.snoozed_until.isoformat() if self.snoozed_until else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_messages:
            data['messages'] = [m.to_dict() for m in self.messages]
        return data

    def __repr__(self):
        return f'<CheckIn {self.id} {self.title!r} status={self.status}>'
