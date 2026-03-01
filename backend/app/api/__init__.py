from app.api.auth.routes import auth_bp
from app.api.categories.routes import categories_bp
from app.api.entries.routes import entries_bp
from app.api.users.routes import users_bp
from app.api.conversations.routes import conversations_bp
from app.api.patterns.routes import patterns_bp
from app.api.reminders.routes import reminders_bp
from app.api.push.routes import push_bp
from app.api.daily_messages.routes import daily_messages_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(entries_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(conversations_bp)
    app.register_blueprint(patterns_bp)
    app.register_blueprint(reminders_bp)
    app.register_blueprint(push_bp)
    app.register_blueprint(daily_messages_bp)
