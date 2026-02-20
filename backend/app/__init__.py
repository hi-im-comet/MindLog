from flask import Flask, jsonify
from app.config import config_by_name
from app.extensions import db, migrate, jwt, limiter, cors


def create_app(config_name='development'):
    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    cors.init_app(app, resources={
        r"/api/*": {
            "origins": [app.config['FRONTEND_URL']],
            "methods": ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
        }
    })

    # Import models so Flask-Migrate can detect them
    from app import models  # noqa: F401

    # Bind Celery to this Flask app (sets broker URL + app context wrapper)
    from app.tasks.celery_app import configure_celery
    configure_celery(app)

    # Register blueprints
    from app.api import register_blueprints
    register_blueprints(app)

    # Standard error handlers
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"success": False, "error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"success": False, "error": "Method not allowed"}), 405

    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        return jsonify({"success": False, "error": "Rate limit exceeded"}), 429

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"success": False, "error": "Internal server error"}), 500

    # JWT error handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({"success": False, "error": "Token has expired"}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({"success": False, "error": "Invalid token"}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({"success": False, "error": "Authorization token required"}), 401

    @app.route('/health')
    def health():
        return jsonify({"status": "ok"})

    return app
