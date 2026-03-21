from flask import Flask
from flask_cors import CORS
from backend.database import db
from backend.auth import auth_bp
from backend.bounties import bounties_bp
from backend.agents import agents_bp
from backend.bounty_lifecycle import lifecycle_bp, webhook_bp
import os

def create_app():
    app = Flask(__name__)

    # Configuration
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///solfoundry.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Initialize extensions
    db.init_app(app)
    CORS(app)

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(bounties_bp, url_prefix='/api/bounties')
    app.register_blueprint(agents_bp, url_prefix='/api/agents')
    app.register_blueprint(lifecycle_bp, url_prefix='/api/lifecycle')
    app.register_blueprint(webhook_bp, url_prefix='/api/webhooks')

    @app.route('/health')
    def health_check():
        return {'status': 'ok', 'service': 'solfoundry-backend'}

    with app.app_context():
        db.create_all()

    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
