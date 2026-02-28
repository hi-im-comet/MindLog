import uuid
from datetime import datetime, timezone
from app.extensions import db

# Association table for M:N entry <-> category
entry_categories = db.Table(
    'entry_categories',
    db.Column('entry_id', db.UUID(as_uuid=True),
              db.ForeignKey('journal_entries.id', ondelete='CASCADE'), primary_key=True),
    db.Column('category_id', db.UUID(as_uuid=True),
              db.ForeignKey('journal_categories.id', ondelete='CASCADE'), primary_key=True),
)


class JournalEntry(db.Model):
    __tablename__ = 'journal_entries'

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'),
                         nullable=False)
    entry_date = db.Column(db.Date, nullable=False)
    title = db.Column(db.String(255), nullable=True)
    raw_content = db.Column(db.Text, nullable=False)
    word_count = db.Column(db.Integer, nullable=True)
    mood_score = db.Column(db.SmallInteger, nullable=True)
    energy_score = db.Column(db.SmallInteger, nullable=True)
    daily_summary = db.Column(db.Text, nullable=True)
    summary_generated_at = db.Column(db.DateTime(timezone=True), nullable=True)
    is_draft = db.Column(db.Boolean, default=False)
    is_locked = db.Column(db.Boolean, default=False)  # 잠금 여부 (비밀번호는 user_profiles에 전역 저장)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                            onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'entry_date', name='uq_user_entry_date'),
        db.Index('idx_journal_entries_user_date', 'user_id', 'entry_date'),
    )

    # Relationships
    user = db.relationship('User', back_populates='entries')
    categories = db.relationship('JournalCategory', secondary=entry_categories, lazy='joined')
    ai_extraction = db.relationship('EntryAIExtraction', back_populates='entry', uselist=False,
                                     cascade='all, delete-orphan')
    conversation = db.relationship('Conversation', back_populates='entry', uselist=False,
                                    cascade='all, delete-orphan')

    def to_dict(self, full=False, truncate_content=True):
        data = {
            'id': str(self.id),
            'entry_date': self.entry_date.isoformat() if self.entry_date else None,
            'title': self.title,
            'mood_score': self.mood_score,
            'energy_score': self.energy_score,
            'daily_summary': self.daily_summary,
            'is_draft': self.is_draft,
            'is_locked': self.is_locked or False,
            'categories': [c.to_dict() for c in (self.categories or [])],
            'has_conversation': self.conversation is not None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if full:
            data['raw_content'] = self.raw_content
            data['word_count'] = self.word_count
            data['category_segments'] = self.ai_extraction.category_segments if self.ai_extraction else []
        elif truncate_content:
            data['raw_content'] = (self.raw_content[:200] + '...') if self.raw_content and len(self.raw_content) > 200 else self.raw_content
        return data

    def __repr__(self):
        return f'<JournalEntry {self.entry_date}>'
