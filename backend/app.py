from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import os
from datetime import timedelta

from .config import Config
from .models import db, migrate
from .routes.auth import auth_bp
from .routes.bounties import bounties_bp
from .routes.agents import agents_bp

def create_app(config_name='development'):
    app = Flask(__name__)

    # Load configuration
    if config_name == 'testing':
        app.config.from_object('backend.config.TestingConfig')
    elif config_name == 'production':
        app.config.from_object('backend.config.ProductionConfig')
    else:
        app.config.from_object('backend.config.DevelopmentConfig')

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)

    # Configure CORS
    CORS(app, origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://solfoundry.xyz"
    ])

    # Configure JWT
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'dev-secret-key')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    jwt = JWTManager(app)

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(bounties_bp, url_prefix='/api/bounties')
    app.register_blueprint(agents_bp, url_prefix='/api/agents')

    @app.route('/health')
    def health_check():
        return {'status': 'healthy', 'service': 'solfoundry-api'}

    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Not found'}, 404

    @app.errorhandler(500)
    def internal_error(error):
        return {'error': 'Internal server error'}, 500

    return app
