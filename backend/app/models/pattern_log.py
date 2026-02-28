import uuid
from datetime import datetime, timezone
from app.extensions import db


class PatternLog(db.Model):
    __tablename__ = 'pattern_logs'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'log_type', 'period_start', name='uq_pattern_log_period'),
    )

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'),
                         nullable=False, index=True)
    log_type = db.Column(db.String(50), nullable=False)  # 'weekly' | 'monthly' | 'semiannual'
    period_start = db.Column(db.Date, nullable=False)
    period_end = db.Column(db.Date, nullable=False)
    headline = db.Column(db.Text, nullable=False)
    body = db.Column(db.Text, nullable=False)          # 구버전 호환용; 새 레코드는 mirror와 동일
    mirror = db.Column(db.Text, nullable=True)         # 거울: 판단 없는 관찰 (1~5문장)
    data_badges = db.Column(db.JSON, default=list)     # 구체적 데이터 포인트 (최대 5개)
    small_experiment = db.Column(db.Text, nullable=True)  # 이번 기간 해볼 작은 실험 1개
    patterns_found = db.Column(db.JSON, default=list)
    safety_content = db.Column(db.Text, nullable=True)    # 위기 언어 감지 시에만 작성
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
            'mirror': self.mirror,
            'data_badges': self.data_badges or [],
            'small_experiment': self.small_experiment,
            'patterns_found': self.patterns_found or [],
            'safety_content': self.safety_content,
            'entries_analyzed': self.entries_analyzed,
            'is_edited': self.is_edited or False,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None,
        }

    def __repr__(self):
        return f'<PatternLog {self.log_type} {self.period_start}>'
