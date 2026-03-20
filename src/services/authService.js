console.log('// src/services/authService.js');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_super_secret_key';
const INVALIDATED_TOKENS = new Set();
const LOGIN_ATTEMPTS = {};
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 300 * 1000;

function _generateToken(userId, tokenType = 'access') {
  const expiresIn = tokenType === 'access' ? '15m' : '7d';
  return jwt.sign({ userId, type: tokenType }, JWT_SECRET, { expiresIn });
}

function loginUser(username, password) {
  const userId = 1;

  if (LOGIN_ATTEMPTS[username] && LOGIN_ATTEMPTS[username].attempts >= MAX_ATTEMPTS) {
    if ((Date.now() - LOGIN_ATTEMPTS[username].lastAttempt) < LOCKOUT_TIME) {
      console.log(`Account ${username} locked out.`);
      return { accessToken: null, refreshToken: null };
    } else {
      LOGIN_ATTEMPTS[username] = { attempts: 0, lastAttempt: Date.now() };
    }
  }

  if (password === 'secure_password') {
    const accessToken = _generateToken(userId, 'access');
    const refreshToken = _generateToken(userId, 'refresh');
    delete LOGIN_ATTEMPTS[username];
    return { accessToken, refreshToken };
  } else {
    LOGIN_ATTEMPTS[username] = LOGIN_ATTEMPTS[username] || { attempts: 0, lastAttempt: Date.now() };
    LOGIN_ATTEMPTS[username].attempts++;
    LOGIN_ATTEMPTS[username].lastAttempt = Date.now();
    console.log(`Login failed for ${username}. Attempts: ${LOGIN_ATTEMPTS[username].attempts}`);
    return { accessToken: null, refreshToken: null };
  }
}

function refreshAccessToken(oldRefreshToken) {
  try {
    const payload = jwt.verify(oldRefreshToken, JWT_SECRET);
    if (payload.type !== 'refresh' || INVALIDATED_TOKENS.has(oldRefreshToken)) {
      throw new Error('Invalid refresh token');
    }

    INVALIDATED_TOKENS.add(oldRefreshToken);
    const newAccessToken = _generateToken(payload.userId, 'access');
    const newRefreshToken = _generateToken(payload.userId, 'refresh');
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (error) {
    console.error(`Refresh token error: ${error.message}`);
    return { accessToken: null, refreshToken: null };
  }
}

function invalidateSession(token) {
  INVALIDATED_TOKENS.add(token);
  console.log('Token invalidated.');
}

module.exports = { loginUser, refreshAccessToken, invalidateSession };
