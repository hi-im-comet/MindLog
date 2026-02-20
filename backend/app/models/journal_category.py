import uuid
from datetime import datetime, timezone
from app.extensions import db


class JournalCategory(db.Model):
    __tablename__ = 'journal_categories'

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'),
                         nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    icon = db.Column(db.String(50), nullable=True)
    color = db.Column(db.String(7), nullable=True)
    is_default = db.Column(db.Boolean, default=False)
    display_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship('User', back_populates='categories')

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'icon': self.icon,
            'color': self.color,
            'is_default': self.is_default,
            'display_order': self.display_order,
            'is_active': self.is_active,
        }

    def __repr__(self):
        return f'<JournalCategory {self.name}>'
