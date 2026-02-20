"""
Celery worker entry point.

Run with:
    celery -A celery_worker worker --loglevel=info
    celery -A celery_worker beat --loglevel=info   # for scheduled tasks
"""
import os
from app import create_app
from app.tasks.celery_app import celery, configure_celery  # noqa: F401 - celery must be imported

flask_app = create_app(os.getenv('FLASK_ENV', 'development'))
configure_celery(flask_app)
