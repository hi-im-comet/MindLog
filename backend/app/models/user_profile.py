import uuid
from datetime import datetime, timezone, date
from app.extensions import db


class UserProfile(db.Model):
    __tablename__ = 'user_profiles'

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'),
                         unique=True, nullable=False)
    summary = db.Column(db.Text, nullable=True)
    known_patterns = db.Column(db.JSON, default=list)
    known_triggers = db.Column(db.JSON, default=list)
    communication_style = db.Column(db.Text, nullable=True)
    preferred_response_mode = db.Column(db.String(50), default='empathetic')
    ai_name = db.Column(db.String(50), nullable=True)  # 사용자가 AI에게 붙인 이름
    total_entries = db.Column(db.Integer, default=0)
    consecutive_days = db.Column(db.Integer, default=0)
    last_entry_date = db.Column(db.Date, nullable=True)
    entry_lock_enabled = db.Column(db.Boolean, default=False)
    lock_password_hash = db.Column(db.String(255), nullable=True)  # 전역 잠금 비밀번호 해시
    failed_lock_attempts = db.Column(db.Integer, default=0, nullable=False)
    failed_lock_at = db.Column(db.DateTime(timezone=True), nullable=True)
    auto_lock_enabled = db.Column(db.Boolean, default=False, nullable=False)
    auto_lock_timeout = db.Column(db.Integer, default=30, nullable=False)  # 분 단위
    last_analysis_at = db.Column(db.DateTime(timezone=True), nullable=True)
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                            onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship('User', back_populates='profile')

    def to_dict(self):
        return {
            'summary': self.summary,
            'known_patterns': self.known_patterns or [],
            'known_triggers': self.known_triggers or [],
            'communication_style': self.communication_style,
            'preferred_response_mode': self.preferred_response_mode,
            'ai_name': self.ai_name,
            'total_entries': self.total_entries,
            'consecutive_days': self.consecutive_days or 0,
            'entry_lock_enabled': self.entry_lock_enabled or False,
            'has_lock_password': self.lock_password_hash is not None,
            'auto_lock_enabled': self.auto_lock_enabled or False,
            'auto_lock_timeout': self.auto_lock_timeout or 30,
            'last_analysis_at': self.last_analysis_at.isoformat() if self.last_analysis_at else None,
        }

    def __repr__(self):
        return f'<UserProfile user_id={self.user_id}>'
