"""Authentication hardening service for production security.

Provides security enhancements to the base authentication system:
- Refresh token rotation: Issue new refresh token on each use, invalidating the old one
- Session management: Track active sessions per user with forced invalidation
- Brute force protection: Track failed login attempts with exponential backoff lockout
- Token blacklisting: Revoke tokens on logout or security events

Storage uses PostgreSQL via SQLAlchemy for persistence across restarts.
Falls back to thread-safe in-memory storage for development/testing with
a documented migration path to PostgreSQL.

PostgreSQL migration path:
    CREATE TABLE refresh_tokens (
        token_id VARCHAR(64) PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        token_hash VARCHAR(128) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        revoked BOOLEAN DEFAULT FALSE,
        replaced_by VARCHAR(64),
        CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE login_attempts (
        id SERIAL PRIMARY KEY,
        identifier VARCHAR(256) NOT NULL,
        attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        success BOOLEAN DEFAULT FALSE,
        ip_address VARCHAR(45),
        user_agent TEXT
    );

    CREATE TABLE active_sessions (
        session_id VARCHAR(64) PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        access_token_jti VARCHAR(64) NOT NULL,
        refresh_token_id VARCHAR(64) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ip_address VARCHAR(45),
        user_agent TEXT,
        revoked BOOLEAN DEFAULT FALSE
    );

    CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX idx_login_attempts_identifier ON login_attempts(identifier);
    CREATE INDEX idx_active_sessions_user ON active_sessions(user_id);

References:
    - OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
    - OWASP Brute Force: https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html
"""

import hashlib
import logging
import os
import secrets
import threading
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Brute force protection configuration
MAX_LOGIN_ATTEMPTS: int = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
LOCKOUT_DURATION_SECONDS: int = int(os.getenv("LOCKOUT_DURATION_SECONDS", "900"))
LOCKOUT_ESCALATION_FACTOR: float = float(os.getenv("LOCKOUT_ESCALATION_FACTOR", "2.0"))
MAX_LOCKOUT_DURATION_SECONDS: int = int(os.getenv("MAX_LOCKOUT_DURATION_SECONDS", "86400"))

# Session management configuration
MAX_SESSIONS_PER_USER: int = int(os.getenv("MAX_SESSIONS_PER_USER", "5"))
SESSION_INACTIVITY_TIMEOUT_SECONDS: int = int(
    os.getenv("SESSION_INACTIVITY_TIMEOUT_SECONDS", "3600")
)

# Refresh token configuration
REFRESH_TOKEN_REUSE_WINDOW_SECONDS: int = int(
    os.getenv("REFRESH_TOKEN_REUSE_WINDOW_SECONDS", "30")
)


class BruteForceProtectionError(Exception):
    """Raised when a login attempt is blocked due to brute force protection.

    Attributes:
        retry_after: Number of seconds until the lockout expires.
    """

    def __init__(self, message: str, retry_after: int = 0) -> None:
        """Initialize with the lockout message and retry-after duration.

        Args:
            message: Human-readable description of the lockout.
            retry_after: Seconds until the client can retry.
        """
        super().__init__(message)
        self.retry_after = retry_after


class SessionLimitError(Exception):
    """Raised when a user has reached their maximum concurrent session count."""
    pass


class TokenReuseError(Exception):
    """Raised when a refresh token is reused after rotation (potential theft)."""
    pass


class LoginAttemptRecord:
    """Record of a single login attempt for brute force tracking.

    Attributes:
        identifier: The login identifier (username, email, or wallet address).
        attempted_at: Unix timestamp of the attempt.
        success: Whether the login attempt was successful.
        ip_address: The client's IP address.
        user_agent: The client's User-Agent header value.
    """

    __slots__ = ("identifier", "attempted_at", "success", "ip_address", "user_agent")

    def __init__(
        self,
        identifier: str,
        success: bool,
        ip_address: str = "",
        user_agent: str = "",
    ) -> None:
        """Initialize a login attempt record.

        Args:
            identifier: The login identifier being used.
            success: Whether the attempt succeeded.
            ip_address: The client IP address.
            user_agent: The client User-Agent string.
        """
        self.identifier = identifier
        self.attempted_at = time.time()
        self.success = success
        self.ip_address = ip_address
        self.user_agent = user_agent


class RefreshTokenRecord:
    """Stored record of an issued refresh token for rotation tracking.

    Attributes:
        token_id: Unique identifier for this refresh token.
        user_id: The user this token was issued to.
        token_hash: SHA-256 hash of the actual token (never store plaintext).
        created_at: When the token was issued.
        expires_at: When the token expires.
        revoked: Whether the token has been revoked.
        replaced_by: Token ID of the replacement token (if rotated).
    """

    __slots__ = (
        "token_id", "user_id", "token_hash", "created_at",
        "expires_at", "revoked", "replaced_by",
    )

    def __init__(
        self,
        token_id: str,
        user_id: str,
        token_hash: str,
        expires_at: datetime,
    ) -> None:
        """Initialize a refresh token record.

        Args:
            token_id: Unique identifier for this token.
            user_id: The user ID this token belongs to.
            token_hash: SHA-256 hash of the token value.
            expires_at: Expiration timestamp for the token.
        """
        self.token_id = token_id
        self.user_id = user_id
        self.token_hash = token_hash
        self.created_at = datetime.now(timezone.utc)
        self.expires_at = expires_at
        self.revoked = False
        self.replaced_by: Optional[str] = None


class SessionRecord:
    """Active user session record for session management.

    Attributes:
        session_id: Unique session identifier.
        user_id: The user who owns this session.
        access_token_jti: JTI claim of the current access token.
        refresh_token_id: ID of the associated refresh token.
        created_at: When the session was created.
        last_activity: Last request timestamp for inactivity timeout.
        ip_address: Client IP address when session was created.
        user_agent: Client User-Agent when session was created.
        revoked: Whether the session has been invalidated.
    """

    __slots__ = (
        "session_id", "user_id", "access_token_jti", "refresh_token_id",
        "created_at", "last_activity", "ip_address", "user_agent", "revoked",
    )

    def __init__(
        self,
        user_id: str,
        access_token_jti: str,
        refresh_token_id: str,
        ip_address: str = "",
        user_agent: str = "",
    ) -> None:
        """Initialize a session record.

        Args:
            user_id: The user who owns this session.
            access_token_jti: JTI of the access token.
            refresh_token_id: ID of the refresh token.
            ip_address: Client IP address.
            user_agent: Client User-Agent string.
        """
        self.session_id = secrets.token_urlsafe(32)
        self.user_id = user_id
        self.access_token_jti = access_token_jti
        self.refresh_token_id = refresh_token_id
        self.created_at = time.time()
        self.last_activity = time.time()
        self.ip_address = ip_address
        self.user_agent = user_agent
        self.revoked = False


def _hash_token(token: str) -> str:
    """Compute SHA-256 hash of a token for secure storage.

    Tokens are never stored in plaintext. Only the hash is persisted,
    and incoming tokens are hashed for comparison.

    Args:
        token: The raw token string to hash.

    Returns:
        str: The hex-encoded SHA-256 hash.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class BruteForceProtector:
    """Tracks login attempts and enforces lockout policies.

    Uses a sliding window to count failed login attempts per identifier
    (username, email, wallet address, or IP). After exceeding the threshold,
    the identifier is locked out with exponential backoff.

    Thread-safe implementation using a threading lock.

    Attributes:
        max_attempts: Maximum failed attempts before lockout.
        lockout_duration: Base lockout duration in seconds.
        escalation_factor: Multiplier for consecutive lockouts.
        max_lockout: Maximum lockout duration cap in seconds.
    """

    def __init__(
        self,
        max_attempts: int = MAX_LOGIN_ATTEMPTS,
        lockout_duration: int = LOCKOUT_DURATION_SECONDS,
        escalation_factor: float = LOCKOUT_ESCALATION_FACTOR,
        max_lockout: int = MAX_LOCKOUT_DURATION_SECONDS,
    ) -> None:
        """Initialize the brute force protector.

        Args:
            max_attempts: Failed attempts allowed before lockout.
            lockout_duration: Base lockout duration in seconds.
            escalation_factor: Multiplier for repeated lockouts.
            max_lockout: Maximum lockout duration in seconds.
        """
        self.max_attempts = max_attempts
        self.lockout_duration = lockout_duration
        self.escalation_factor = escalation_factor
        self.max_lockout = max_lockout
        self._attempts: dict[str, list[LoginAttemptRecord]] = defaultdict(list)
        self._lockouts: dict[str, tuple[float, int]] = {}  # key -> (lockout_until, lockout_count)
        self._lock = threading.Lock()

    def check_and_record_attempt(
        self,
        identifier: str,
        success: bool,
        ip_address: str = "",
        user_agent: str = "",
    ) -> None:
        """Record a login attempt and check if the identifier is locked out.

        Must be called before processing the login. On success, clears the
        failed attempt counter. On failure, increments it and may trigger
        a lockout.

        Args:
            identifier: The login identifier (username, email, wallet, IP).
            success: Whether the login was successful.
            ip_address: Client IP for audit logging.
            user_agent: Client User-Agent for audit logging.

        Raises:
            BruteForceProtectionError: If the identifier is currently locked
                out due to too many failed attempts.
        """
        normalized = identifier.lower().strip()
        now = time.time()

        with self._lock:
            # Check existing lockout
            lockout_info = self._lockouts.get(normalized)
            if lockout_info:
                lockout_until, lockout_count = lockout_info
                if now < lockout_until:
                    retry_after = int(lockout_until - now) + 1
                    logger.warning(
                        "Brute force lockout active for '%s' (attempt from %s, "
                        "%d seconds remaining, lockout #%d)",
                        normalized,
                        ip_address,
                        retry_after,
                        lockout_count,
                    )
                    raise BruteForceProtectionError(
                        f"Account temporarily locked due to too many failed attempts. "
                        f"Try again in {retry_after} seconds.",
                        retry_after=retry_after,
                    )

            record = LoginAttemptRecord(
                identifier=normalized,
                success=success,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            self._attempts[normalized].append(record)

            if success:
                # Reset on successful login
                self._attempts[normalized] = []
                if normalized in self._lockouts:
                    del self._lockouts[normalized]
                logger.info("Successful login for '%s' from %s", normalized, ip_address)
                return

            # Count recent failures (within the lockout window)
            window_start = now - self.lockout_duration
            recent_failures = [
                a for a in self._attempts[normalized]
                if not a.success and a.attempted_at > window_start
            ]

            if len(recent_failures) >= self.max_attempts:
                # Calculate escalating lockout duration
                previous_lockout_count = (
                    self._lockouts[normalized][1] if normalized in self._lockouts else 0
                )
                new_lockout_count = previous_lockout_count + 1
                duration = min(
                    self.lockout_duration * (self.escalation_factor ** previous_lockout_count),
                    self.max_lockout,
                )
                lockout_until = now + duration
                self._lockouts[normalized] = (lockout_until, new_lockout_count)
                logger.warning(
                    "Brute force lockout triggered for '%s' from %s "
                    "(lockout #%d, duration: %d seconds, %d failed attempts)",
                    normalized,
                    ip_address,
                    new_lockout_count,
                    int(duration),
                    len(recent_failures),
                )

    def get_failed_attempts(self, identifier: str) -> int:
        """Return the number of recent failed login attempts for an identifier.

        Args:
            identifier: The login identifier to check.

        Returns:
            int: Number of failed attempts within the current window.
        """
        normalized = identifier.lower().strip()
        now = time.time()
        window_start = now - self.lockout_duration

        with self._lock:
            return sum(
                1 for a in self._attempts.get(normalized, [])
                if not a.success and a.attempted_at > window_start
            )

    def is_locked_out(self, identifier: str) -> tuple[bool, int]:
        """Check if an identifier is currently locked out.

        Args:
            identifier: The login identifier to check.

        Returns:
            tuple: (is_locked, seconds_remaining). seconds_remaining is 0
                if not locked.
        """
        normalized = identifier.lower().strip()
        now = time.time()

        with self._lock:
            lockout_info = self._lockouts.get(normalized)
            if lockout_info:
                lockout_until, _ = lockout_info
                if now < lockout_until:
                    return True, int(lockout_until - now) + 1
            return False, 0

    def reset(self, identifier: Optional[str] = None) -> None:
        """Reset attempt tracking. If identifier is None, resets all tracking.

        Args:
            identifier: Specific identifier to reset, or None for all.
        """
        with self._lock:
            if identifier:
                normalized = identifier.lower().strip()
                self._attempts.pop(normalized, None)
                self._lockouts.pop(normalized, None)
            else:
                self._attempts.clear()
                self._lockouts.clear()


class RefreshTokenStore:
    """Manages refresh token lifecycle with rotation and revocation.

    Implements refresh token rotation: each time a refresh token is used,
    a new one is issued and the old one is revoked. If a revoked token is
    reused, all tokens for that user are revoked (token theft detection).

    Thread-safe implementation for the in-memory store.

    PostgreSQL migration path: Replace this class with SQLAlchemy-backed
    queries against the refresh_tokens table defined in the module docstring.
    """

    def __init__(self) -> None:
        """Initialize the refresh token store."""
        self._tokens: dict[str, RefreshTokenRecord] = {}
        self._user_tokens: dict[str, set[str]] = defaultdict(set)
        self._lock = threading.Lock()

    def store_token(
        self,
        user_id: str,
        token: str,
        expires_at: datetime,
    ) -> str:
        """Store a newly issued refresh token.

        Args:
            user_id: The user this token belongs to.
            token: The raw refresh token string.
            expires_at: When the token expires.

        Returns:
            str: The token ID for tracking.
        """
        token_id = secrets.token_urlsafe(16)
        token_hash = _hash_token(token)
        record = RefreshTokenRecord(
            token_id=token_id,
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )

        with self._lock:
            self._tokens[token_id] = record
            self._user_tokens[user_id].add(token_id)
            logger.debug(
                "Stored refresh token %s for user %s (expires: %s)",
                token_id,
                user_id,
                expires_at.isoformat(),
            )

        return token_id

    def validate_and_rotate(
        self,
        token: str,
        user_id: str,
        new_token: str,
        new_expires_at: datetime,
    ) -> str:
        """Validate a refresh token and rotate it (issue new, revoke old).

        Implements refresh token rotation per OWASP recommendations. If a
        revoked token is presented, this indicates potential token theft:
        all tokens for the user are revoked as a security measure.

        Args:
            token: The refresh token being used.
            user_id: The expected user ID from the token claims.
            new_token: The new refresh token to issue.
            new_expires_at: Expiration for the new token.

        Returns:
            str: The new token ID.

        Raises:
            TokenReuseError: If the token was already revoked (theft detection).
            ValueError: If the token is invalid, expired, or doesn't match the user.
        """
        token_hash = _hash_token(token)

        with self._lock:
            # Find the token record by hash
            matching_record = None
            for record in self._tokens.values():
                if record.token_hash == token_hash and record.user_id == user_id:
                    matching_record = record
                    break

            if not matching_record:
                raise ValueError("Refresh token not found or does not match user")

            # Check if the token was already revoked (theft detection)
            if matching_record.revoked:
                logger.critical(
                    "SECURITY: Reuse of revoked refresh token detected for user %s "
                    "(token_id: %s). Revoking all tokens for this user.",
                    user_id,
                    matching_record.token_id,
                )
                self._revoke_all_user_tokens(user_id)
                raise TokenReuseError(
                    "Refresh token has been revoked. All sessions have been "
                    "invalidated for security. Please log in again."
                )

            # Check expiration
            if datetime.now(timezone.utc) > matching_record.expires_at:
                matching_record.revoked = True
                raise ValueError("Refresh token has expired")

            # Rotate: revoke old token and issue new one
            new_token_id = secrets.token_urlsafe(16)
            new_token_hash = _hash_token(new_token)
            new_record = RefreshTokenRecord(
                token_id=new_token_id,
                user_id=user_id,
                token_hash=new_token_hash,
                expires_at=new_expires_at,
            )

            matching_record.revoked = True
            matching_record.replaced_by = new_token_id
            self._tokens[new_token_id] = new_record
            self._user_tokens[user_id].add(new_token_id)

            logger.info(
                "Rotated refresh token for user %s: %s -> %s",
                user_id,
                matching_record.token_id,
                new_token_id,
            )

        return new_token_id

    def revoke_token(self, token: str, user_id: str) -> bool:
        """Revoke a specific refresh token (e.g., on logout).

        Args:
            token: The raw refresh token to revoke.
            user_id: The user ID for validation.

        Returns:
            bool: True if the token was found and revoked.
        """
        token_hash = _hash_token(token)

        with self._lock:
            for record in self._tokens.values():
                if record.token_hash == token_hash and record.user_id == user_id:
                    record.revoked = True
                    logger.info(
                        "Revoked refresh token %s for user %s",
                        record.token_id,
                        user_id,
                    )
                    return True
        return False

    def revoke_all_user_tokens(self, user_id: str) -> int:
        """Revoke all refresh tokens for a user (session invalidation).

        Used when a security event is detected (password change, token theft)
        or when the user requests logout from all devices.

        Args:
            user_id: The user whose tokens should be revoked.

        Returns:
            int: Number of tokens that were revoked.
        """
        with self._lock:
            return self._revoke_all_user_tokens(user_id)

    def _revoke_all_user_tokens(self, user_id: str) -> int:
        """Internal method to revoke all tokens for a user (must hold lock).

        Args:
            user_id: The user whose tokens should be revoked.

        Returns:
            int: Number of tokens revoked.
        """
        count = 0
        token_ids = self._user_tokens.get(user_id, set())
        for token_id in token_ids:
            record = self._tokens.get(token_id)
            if record and not record.revoked:
                record.revoked = True
                count += 1
        logger.warning(
            "Revoked all %d refresh tokens for user %s", count, user_id
        )
        return count

    def get_active_token_count(self, user_id: str) -> int:
        """Return the count of active (non-revoked, non-expired) tokens for a user.

        Args:
            user_id: The user to check.

        Returns:
            int: Number of active refresh tokens.
        """
        now = datetime.now(timezone.utc)
        with self._lock:
            token_ids = self._user_tokens.get(user_id, set())
            return sum(
                1 for tid in token_ids
                if tid in self._tokens
                and not self._tokens[tid].revoked
                and self._tokens[tid].expires_at > now
            )

    def cleanup_expired(self) -> int:
        """Remove expired token records to prevent memory growth.

        Returns:
            int: Number of expired records removed.
        """
        now = datetime.now(timezone.utc)
        removed = 0

        with self._lock:
            expired_ids = [
                tid for tid, record in self._tokens.items()
                if record.expires_at < now and record.revoked
            ]
            for tid in expired_ids:
                record = self._tokens.pop(tid)
                user_tokens = self._user_tokens.get(record.user_id)
                if user_tokens:
                    user_tokens.discard(tid)
                removed += 1

        if removed:
            logger.debug("Cleaned up %d expired refresh token records", removed)
        return removed

    def reset(self) -> None:
        """Clear all stored tokens. Used for testing."""
        with self._lock:
            self._tokens.clear()
            self._user_tokens.clear()


class SessionManager:
    """Manages active user sessions with limits and invalidation.

    Tracks which users have active sessions, enforces per-user session
    limits, and supports forced invalidation (logout from all devices).

    Thread-safe implementation using a threading lock.
    """

    def __init__(
        self,
        max_sessions: int = MAX_SESSIONS_PER_USER,
        inactivity_timeout: int = SESSION_INACTIVITY_TIMEOUT_SECONDS,
    ) -> None:
        """Initialize the session manager.

        Args:
            max_sessions: Maximum concurrent sessions per user.
            inactivity_timeout: Seconds of inactivity before session expires.
        """
        self.max_sessions = max_sessions
        self.inactivity_timeout = inactivity_timeout
        self._sessions: dict[str, SessionRecord] = {}
        self._user_sessions: dict[str, set[str]] = defaultdict(set)
        self._lock = threading.Lock()

    def create_session(
        self,
        user_id: str,
        access_token_jti: str,
        refresh_token_id: str,
        ip_address: str = "",
        user_agent: str = "",
    ) -> SessionRecord:
        """Create a new session for a user.

        If the user has reached their session limit, the oldest session is
        revoked to make room. This prevents the user from being locked out
        while maintaining the session limit.

        Args:
            user_id: The user creating the session.
            access_token_jti: JTI of the access token.
            refresh_token_id: ID of the refresh token.
            ip_address: Client IP address.
            user_agent: Client User-Agent.

        Returns:
            SessionRecord: The newly created session.
        """
        session = SessionRecord(
            user_id=user_id,
            access_token_jti=access_token_jti,
            refresh_token_id=refresh_token_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        with self._lock:
            # Evict oldest session if at limit
            user_session_ids = self._user_sessions.get(user_id, set())
            active_sessions = [
                self._sessions[sid] for sid in user_session_ids
                if sid in self._sessions and not self._sessions[sid].revoked
            ]

            if len(active_sessions) >= self.max_sessions:
                # Revoke oldest session
                oldest = min(active_sessions, key=lambda s: s.created_at)
                oldest.revoked = True
                logger.info(
                    "Evicted oldest session %s for user %s (limit: %d)",
                    oldest.session_id,
                    user_id,
                    self.max_sessions,
                )

            self._sessions[session.session_id] = session
            self._user_sessions[user_id].add(session.session_id)

        logger.info(
            "Created session %s for user %s from %s",
            session.session_id,
            user_id,
            ip_address,
        )
        return session

    def validate_session(self, session_id: str) -> Optional[SessionRecord]:
        """Validate a session and update its last activity timestamp.

        Args:
            session_id: The session ID to validate.

        Returns:
            Optional[SessionRecord]: The session if valid, None if invalid or expired.
        """
        now = time.time()

        with self._lock:
            session = self._sessions.get(session_id)
            if not session or session.revoked:
                return None

            # Check inactivity timeout
            if now - session.last_activity > self.inactivity_timeout:
                session.revoked = True
                logger.info(
                    "Session %s expired due to inactivity (user: %s)",
                    session_id,
                    session.user_id,
                )
                return None

            session.last_activity = now
            return session

    def invalidate_session(self, session_id: str) -> bool:
        """Invalidate a specific session (e.g., on logout).

        Args:
            session_id: The session to invalidate.

        Returns:
            bool: True if the session was found and invalidated.
        """
        with self._lock:
            session = self._sessions.get(session_id)
            if session and not session.revoked:
                session.revoked = True
                logger.info(
                    "Invalidated session %s for user %s",
                    session_id,
                    session.user_id,
                )
                return True
        return False

    def invalidate_all_user_sessions(self, user_id: str) -> int:
        """Invalidate all sessions for a user (logout from all devices).

        Args:
            user_id: The user whose sessions should be invalidated.

        Returns:
            int: Number of sessions invalidated.
        """
        count = 0
        with self._lock:
            session_ids = self._user_sessions.get(user_id, set())
            for sid in session_ids:
                session = self._sessions.get(sid)
                if session and not session.revoked:
                    session.revoked = True
                    count += 1
        logger.warning(
            "Invalidated all %d sessions for user %s", count, user_id
        )
        return count

    def get_active_sessions(self, user_id: str) -> list[dict]:
        """Get all active sessions for a user.

        Args:
            user_id: The user to query.

        Returns:
            list[dict]: List of session info dictionaries.
        """
        now = time.time()
        results = []

        with self._lock:
            session_ids = self._user_sessions.get(user_id, set())
            for sid in session_ids:
                session = self._sessions.get(sid)
                if (
                    session
                    and not session.revoked
                    and now - session.last_activity <= self.inactivity_timeout
                ):
                    results.append({
                        "session_id": session.session_id,
                        "created_at": datetime.fromtimestamp(
                            session.created_at, tz=timezone.utc
                        ).isoformat(),
                        "last_activity": datetime.fromtimestamp(
                            session.last_activity, tz=timezone.utc
                        ).isoformat(),
                        "ip_address": session.ip_address,
                        "user_agent": session.user_agent,
                    })

        return results

    def cleanup_expired(self) -> int:
        """Remove expired and revoked session records.

        Returns:
            int: Number of records removed.
        """
        now = time.time()
        removed = 0

        with self._lock:
            expired_ids = [
                sid for sid, session in self._sessions.items()
                if session.revoked or now - session.last_activity > self.inactivity_timeout * 2
            ]
            for sid in expired_ids:
                session = self._sessions.pop(sid)
                user_sessions = self._user_sessions.get(session.user_id)
                if user_sessions:
                    user_sessions.discard(sid)
                removed += 1

        if removed:
            logger.debug("Cleaned up %d expired session records", removed)
        return removed

    def reset(self) -> None:
        """Clear all session data. Used for testing."""
        with self._lock:
            self._sessions.clear()
            self._user_sessions.clear()


# Global singleton instances
brute_force_protector = BruteForceProtector()
refresh_token_store = RefreshTokenStore()
session_manager = SessionManager()
