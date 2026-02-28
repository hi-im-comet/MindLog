from __future__ import annotations
import hashlib
import os
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import Optional
from flask import current_app
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.extensions import db
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.refresh_token import RefreshToken
from app.models.audit_log import AuditLog
from app.models.journal_category import JournalCategory
from app.utils.constants import DEFAULT_CATEGORIES


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def check_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def create_user_with_profile(
    email: str,
    display_name: str,
    password: str = None,
    google_id: str = None,
    avatar_url: str = None,
    ai_nickname: str = None,
) -> User:
    """Create a new user with an empty profile. Does not commit."""
    user = User(
        email=email,
        display_name=display_name,
        password_hash=hash_password(password) if password else None,
        google_id=google_id,
        avatar_url=avatar_url,
    )
    db.session.add(user)
    db.session.flush()

    profile = UserProfile(user_id=user.id, ai_name=ai_nickname)
    db.session.add(profile)

    return user


def seed_default_categories(user_id) -> None:
    """Create default categories for a new user. Does not commit."""
    for cat_data in DEFAULT_CATEGORIES:
        cat = JournalCategory(
            user_id=user_id,
            is_default=True,
            **cat_data,
        )
        db.session.add(cat)


def store_refresh_token(user_id, raw_token: str, expires_delta: timedelta) -> None:
    """Persist a hashed refresh token. Does not commit."""
    token = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(raw_token),
        expires_at=datetime.now(timezone.utc) + expires_delta,
    )
    db.session.add(token)


def revoke_refresh_token(raw_token: str) -> bool:
    token_hash = hash_token(raw_token)
    token = RefreshToken.query.filter_by(token_hash=token_hash, revoked_at=None).first()
    if token:
        token.revoked_at = datetime.now(timezone.utc)
        db.session.commit()
        return True
    return False


def validate_refresh_token(raw_token: str) -> Optional[RefreshToken]:
    token_hash = hash_token(raw_token)
    token = RefreshToken.query.filter_by(token_hash=token_hash, revoked_at=None).first()
    if token and token.is_valid:
        return token
    return None


def verify_google_id_token(credential: str) -> dict:
    """Verify a Google ID token sent from the frontend (using @react-oauth/google)."""
    client_id = current_app.config.get('GOOGLE_CLIENT_ID')
    if not client_id:
        raise ValueError("GOOGLE_CLIENT_ID not configured")
    request = google_requests.Request()
    idinfo = id_token.verify_oauth2_token(credential, request, client_id)
    return idinfo  # contains 'sub', 'email', 'name', 'picture'


def log_audit(user_id, action: str, ip_address: str = None, user_agent: str = None,
              metadata: dict = None) -> None:
    """Write an audit log entry. Does not commit."""
    log = AuditLog(
        user_id=user_id,
        action=action,
        ip_address=ip_address,
        user_agent=user_agent,
        extra_data=metadata or {},
    )
    db.session.add(log)
