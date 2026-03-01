from celery import Celery
from celery.schedules import crontab

# Module-level celery instance — configured later by Flask app factory.
# Tasks import this object directly; configuration is deferred until
# configure_celery() is called inside create_app().
celery = Celery(
    'mindlog',
    include=[
        'app.tasks.entry_tasks',
        'app.tasks.pattern_tasks',
        'app.tasks.reminder_tasks',
    ],
)


def configure_celery(app):
    """Bind the Celery instance to a Flask app (call from create_app)."""
    celery.conf.update(
        broker_url=app.config['REDIS_URL'],
        result_backend=app.config['REDIS_URL'],
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='UTC',
        enable_utc=True,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        # Set True in dev/test when Redis isn't available
        task_always_eager=app.config.get('CELERY_TASK_ALWAYS_EAGER', False),
        beat_schedule={
            'weekly-pattern-analysis': {
                'task': 'app.tasks.pattern_tasks.generate_weekly_patterns',
                'schedule': crontab(day_of_week='monday', hour=6, minute=0),
            },
            'poll-due-reminders': {
                'task': 'app.tasks.reminder_tasks.poll_due_reminders',
                'schedule': crontab(minute='*'),
            },
        },
    )

    class ContextTask(celery.Task):
        """Wrap every task execution in a Flask application context."""
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery
