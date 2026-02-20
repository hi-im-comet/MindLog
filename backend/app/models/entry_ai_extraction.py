import uuid
from datetime import datetime, timezone
from app.extensions import db


class EntryAIExtraction(db.Model):
    __tablename__ = 'entry_ai_extractions'

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey('journal_entries.id', ondelete='CASCADE'),
                          unique=True, nullable=False, index=True)
    mood_keywords = db.Column(db.JSON, default=list)
    topics = db.Column(db.JSON, default=list)
    sentiment_score = db.Column(db.Float, nullable=True)
    stress_indicators = db.Column(db.JSON, default=list)
    sleep_mentioned = db.Column(db.Boolean, default=False)
    meals_mentioned = db.Column(db.Boolean, default=False)
    work_mentioned = db.Column(db.Boolean, default=False)
    exercise_mentioned = db.Column(db.Boolean, default=False)
    category_segments = db.Column(db.JSON, default=list)
    # 인지 왜곡 목록: [{"type": "흑백논리", "evidence": "...", "severity": 1-3}]
    cognitive_distortions = db.Column(db.JSON, default=list)
    extraction_model = db.Column(db.String(100), nullable=True)
    extracted_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    entry = db.relationship('JournalEntry', back_populates='ai_extraction')

    def to_dict(self):
        return {
            'mood_keywords': self.mood_keywords or [],
            'topics': self.topics or [],
            'sentiment_score': self.sentiment_score,
            'stress_indicators': self.stress_indicators or [],
            'sleep_mentioned': self.sleep_mentioned,
            'meals_mentioned': self.meals_mentioned,
            'work_mentioned': self.work_mentioned,
            'exercise_mentioned': self.exercise_mentioned,
            'category_segments': self.category_segments or [],
            'cognitive_distortions': self.cognitive_distortions or [],
            'extracted_at': self.extracted_at.isoformat() if self.extracted_at else None,
        }

    def __repr__(self):
        return f'<EntryAIExtraction entry_id={self.entry_id}>'
