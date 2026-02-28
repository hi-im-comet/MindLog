from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS


def _rate_limit_key() -> str:
    """key_func that never returns None (Flask-Limiter can return 403 when key is None)."""
    return get_remote_address() or "proxy"


db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
limiter = Limiter(key_func=_rate_limit_key)
cors = CORS()
