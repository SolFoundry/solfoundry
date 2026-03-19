from functools import wraps
from flask import request, jsonify, current_app, g
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt, verify_jwt_in_request
import jwt
from datetime import datetime, timedelta
import redis
from app.models.user import User

# Redis client for token blacklisting
redis_client = redis.Redis.from_url(current_app.config.get('REDIS_URL', 'redis://localhost:6379'))

def token_required(f):
    """Decorator for routes that require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header:
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            # Check if token is blacklisted
            if redis_client.get(f"blacklisted_token:{token}"):
                return jsonify({'error': 'Token has been revoked'}), 401
            
            # Decode token
            data = jwt.decode(
                token, 
                current_app.config['JWT_SECRET_KEY'], 
                algorithms=['HS256']
            )
            
            # Check token expiration
            if datetime.utcnow().timestamp() > data['exp']:
                return jsonify({'error': 'Token has expired'}), 401
            
            # Get user
            current_user = User.query.get(data['user_id'])
            if not current_user:
                return jsonify({'error': 'User not found'}), 401
            
            g.current_user = current_user
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            return jsonify({'error': 'Token validation failed'}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function

def admin_required(f):
    """Decorator for routes that require admin privileges"""
    @wraps(f)
    @token_required
    def decorated_function(*args, **kwargs):
        if not g.current_user.is_admin:
            return jsonify({'error': 'Admin privileges required'}), 403
        return f(*args, **kwargs)
    
    return decorated_function

def wallet_verified_required(f):
    """Decorator for routes that require wallet verification"""
    @wraps(f)
    @token_required
    def decorated_function(*args, **kwargs):
        if not g.current_user.wallet_address:
            return jsonify({'error': 'Wallet verification required'}), 403
        return f(*args, **kwargs)
    
    return decorated_function

def jwt_middleware():
    """Middleware to handle JWT token validation"""
    if request.endpoint in ['auth.login', 'auth.register', 'auth.github_callback', 'auth.wallet_connect']:
        return
    
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(" ")[1]
        
        # Check if token is blacklisted
        if redis_client.get(f"blacklisted_token:{token}"):
            return jsonify({'error': 'Token has been revoked'}), 401
        
        try:
            # Verify JWT token
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            
            # Get user and attach to request context
            user = User.query.get(user_id)
            if user:
                g.current_user = user
            
        except Exception:
            pass

def blacklist_token(token):
    """Add token to blacklist"""
    try:
        # Decode to get expiration time
        decoded = jwt.decode(
            token, 
            current_app.config['JWT_SECRET_KEY'], 
            algorithms=['HS256']
        )
        
        # Calculate TTL until token expires
        exp_timestamp = decoded['exp']
        current_timestamp = datetime.utcnow().timestamp()
        ttl = int(exp_timestamp - current_timestamp)
        
        if ttl > 0:
            # Add to blacklist with TTL
            redis_client.setex(
                f"blacklisted_token:{token}", 
                ttl, 
                "blacklisted"
            )
        
        return True
    except Exception:
        return False

def refresh_token_if_needed():
    """Check if token needs refresh and return new token if necessary"""
    try:
        verify_jwt_in_request()
        claims = get_jwt()
        
        # Check if token expires within 10 minutes
        exp_timestamp = claims['exp']
        current_timestamp = datetime.utcnow().timestamp()
        
        if exp_timestamp - current_timestamp < 600:  # 10 minutes
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            
            if user:
                # Generate new token
                new_token = jwt.encode({
                    'user_id': user.id,
                    'github_id': user.github_id,
                    'wallet_address': user.wallet_address,
                    'exp': datetime.utcnow() + timedelta(hours=24),
                    'iat': datetime.utcnow()
                }, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')
                
                return {
                    'refresh_needed': True,
                    'new_token': new_token
                }
        
        return {'refresh_needed': False}
        
    except Exception:
        return {'refresh_needed': False}

def validate_api_key():
    """Validate API key for external integrations"""
    api_key = request.headers.get('X-API-Key')
    
    if not api_key:
        return False
    
    # Check against configured API keys
    valid_keys = current_app.config.get('API_KEYS', [])
    return api_key in valid_keys

def rate_limit_by_user():
    """Rate limiting by user ID"""
    if hasattr(g, 'current_user') and g.current_user:
        user_id = g.current_user.id
        key = f"rate_limit:user:{user_id}"
        
        # Check current request count
        current_count = redis_client.get(key)
        
        if current_count is None:
            # First request in window
            redis_client.setex(key, 3600, 1)  # 1 hour window
            return True
        
        if int(current_count) >= 1000:  # 1000 requests per hour
            return False
        
        # Increment counter
        redis_client.incr(key)
        return True
    
    return True

def cors_middleware():
    """Handle CORS headers"""
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'OK'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response