import uuid
from datetime import datetime, timezone
from app.extensions import db


class PatternLog(db.Model):
    __tablename__ = 'pattern_logs'

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'),
                         nullable=False, index=True)
    log_type = db.Column(db.String(50), nullable=False)  # 'weekly' | 'monthly' | 'milestone'
    period_start = db.Column(db.Date, nullable=False)
    period_end = db.Column(db.Date, nullable=False)
    headline = db.Column(db.Text, nullable=False)
    body = db.Column(db.Text, nullable=False)
    patterns_found = db.Column(db.JSON, default=list)
    entries_analyzed = db.Column(db.Integer, nullable=True)
    model_used = db.Column(db.String(100), nullable=True)
    is_edited = db.Column(db.Boolean, default=False)
    generated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship('User', back_populates='pattern_logs')

    def to_dict(self):
        return {
            'id': str(self.id),
            'log_type': self.log_type,
            'period_start': self.period_start.isoformat() if self.period_start else None,
            'period_end': self.period_end.isoformat() if self.period_end else None,
            'headline': self.headline,
            'body': self.body,
            'patterns_found': self.patterns_found or [],
            'entries_analyzed': self.entries_analyzed,
            'is_edited': self.is_edited or False,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None,
        }

    def __repr__(self):
        return f'<PatternLog {self.log_type} {self.period_start}>'
