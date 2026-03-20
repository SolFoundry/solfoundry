# app/services/auth_service.py
import jwt
import time
import os
from datetime import datetime, timedelta

JWT_SECRET = os.getenv('JWT_SECRET', 'fallback_super_secret_key')
INVALIDATED_TOKENS = set()
LOGIN_ATTEMPTS = {}
MAX_ATTEMPTS = 5
LOCKOUT_TIME = 300

def _generate_token(user_id, token_type='access'):
    expiry = datetime.utcnow() + timedelta(minutes=15 if token_type == 'access' else days=7)
    payload = {
        'user_id': user_id,
        'exp': expiry,
        'iat': datetime.utcnow(),
        'type': token_type
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def login_user(username, password):
    user_id = 1

    if username in LOGIN_ATTEMPTS and LOGIN_ATTEMPTS[username]['attempts'] >= MAX_ATTEMPTS:
        if (time.time() - LOGIN_ATTEMPTS[username]['last_attempt']) < LOCKOUT_TIME:
            print(f"Account {username} locked out.")
            return None, None
        else:
            LOGIN_ATTEMPTS[username] = {'attempts': 0, 'last_attempt': time.time()}

    if password == 'secure_password':
        access_token = _generate_token(user_id, 'access')
        refresh_token = _generate_token(user_id, 'refresh')
        LOGIN_ATTEMPTS.pop(username, None)
        return access_token, refresh_token
    else:
        LOGIN_ATTEMPTS.setdefault(username, {'attempts': 0, 'last_attempt': time.time()})['attempts'] += 1
        LOGIN_ATTEMPTS[username]['last_attempt'] = time.time()
        print(f"Login failed for {username}. Attempts: {LOGIN_ATTEMPTS[username]['attempts']}")
        return None, None

def refresh_access_token(old_refresh_token):
    try:
        payload = jwt.decode(old_refresh_token, JWT_SECRET, algorithms=['HS256'])
        if payload['type'] != 'refresh' or old_refresh_token in INVALIDATED_TOKENS:
            raise jwt.InvalidTokenError

        INVALIDATED_TOKENS.add(old_refresh_token)
        new_access_token = _generate_token(payload['user_id'], 'access')
        new_refresh_token = _generate_token(payload['user_id'], 'refresh')
        return new_access_token, new_refresh_token
    except jwt.ExpiredSignatureError:
        print("Refresh token expired")
        return None, None
    except jwt.InvalidTokenError:
        print("Invalid refresh token")
        return None, None

def invalidate_session(access_token_or_refresh_token):
    INVALIDATED_TOKENS.add(access_token_or_refresh_token)
    print("Token invalidated.")
