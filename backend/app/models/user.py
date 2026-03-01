import uuid
from datetime import datetime, timezone
from app.extensions import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=True)
    google_id = db.Column(db.String(255), unique=True, nullable=True, index=True)
    display_name = db.Column(db.String(100), nullable=False)
    avatar_url = db.Column(db.Text, nullable=True)
    timezone = db.Column(db.String(50), default='UTC')
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    onboarding_completed = db.Column(db.Boolean, default=False)

    # Relationships
    profile = db.relationship('UserProfile', back_populates='user', uselist=False,
                               cascade='all, delete-orphan')
    categories = db.relationship('JournalCategory', back_populates='user',
                                  cascade='all, delete-orphan')
    entries = db.relationship('JournalEntry', back_populates='user',
                               cascade='all, delete-orphan')
    conversations = db.relationship('Conversation', back_populates='user',
                                     cascade='all, delete-orphan')
    pattern_logs = db.relationship('PatternLog', back_populates='user',
                                    cascade='all, delete-orphan')
    refresh_tokens = db.relationship('RefreshToken', back_populates='user',
                                      cascade='all, delete-orphan')
    check_ins = db.relationship('CheckIn', backref='user', lazy='dynamic',
                                cascade='all, delete-orphan')
    push_subscriptions = db.relationship('PushSubscription', backref='user', lazy='dynamic',
                                         cascade='all, delete-orphan')

    def to_dict(self, include_profile=False):
        data = {
            'id': str(self.id),
            'email': self.email,
            'display_name': self.display_name,
            'avatar_url': self.avatar_url,
            'timezone': self.timezone,
            'onboarding_completed': self.onboarding_completed,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_profile and self.profile:
            data['profile'] = self.profile.to_dict()
        return data

    def __repr__(self):
        return f'<User {self.email}>'
