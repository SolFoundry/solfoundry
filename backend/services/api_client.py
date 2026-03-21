import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urljoin

import aiohttp
from aiohttp import ClientSession, ClientTimeout, ClientError

logger = logging.getLogger(__name__)

class CacheEntry:
    def __init__(self, data: Any, timestamp: float, ttl: int):
        self.data = data
        self.timestamp = timestamp
        self.ttl = ttl

class RetryConfig:
    def __init__(self, max_retries: int = 3, base_delay: float = 1.0, max_delay: float = 10.0):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay

class ApiClientConfig:
    def __init__(
        self,
        base_url: str = "http://localhost:8000/api/v1",
        timeout: float = 10.0,
        default_cache_ttl: int = 300,
        retry_config: Optional[RetryConfig] = None
    ):
        self.base_url = base_url
        self.timeout = timeout
        self.default_cache_ttl = default_cache_ttl
        self.retry_config = retry_config or RetryConfig()

class AuthTokens:
    def __init__(self, access_token: str, refresh_token: Optional[str] = None):
        self.access_token = access_token
        self.refresh_token = refresh_token

class BountyFilters:
    def __init__(
        self,
        status: Optional[str] = None,
        tier: Optional[str] = None,
        category: Optional[str] = None,
        phase: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ):
        self.status = status
        self.tier = tier
        self.category = category
        self.phase = phase
        self.page = page
        self.limit = limit

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.__dict__.items() if v is not None}

class LeaderboardFilters:
    def __init__(
        self,
        timeframe: Optional[str] = None,
        category: Optional[str] = None,
        limit: Optional[int] = None
    ):
        self.timeframe = timeframe
        self.category = category
        self.limit = limit

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.__dict__.items() if v is not None}

class ApiClient:
    def __init__(self, config: Optional[ApiClientConfig] = None):
        self.config = config or ApiClientConfig()
        self.cache: Dict[str, CacheEntry] = {}
        self.tokens: Optional[AuthTokens] = None
        self.session: Optional[ClientSession] = None

    async def _get_session(self) -> ClientSession:
        if self.session is None or self.session.closed:
            timeout = ClientTimeout(total=self.config.timeout)
            headers = {"Content-Type": "application/json"}

            if self.tokens and self.tokens.access_token:
                headers["Authorization"] = f"Bearer {self.tokens.access_token}"

            self.session = ClientSession(
                timeout=timeout,
                headers=headers,
                base_url=self.config.base_url
            )

        return self.session

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()

    def set_tokens(self, tokens: AuthTokens):
        self.tokens = tokens

    def clear_tokens(self):
        self.tokens = None
        self.cache.clear()

    async def refresh_token(self):
        if not self.tokens or not self.tokens.refresh_token:
            raise Exception("No refresh token available")

        try:
            session = await self._get_session()
            async with session.post("/auth/refresh", json={"refresh_token": self.tokens.refresh_token}) as response:
                if response.status == 200:
                    data = await response.json()
                    self.tokens.access_token = data["access_token"]
                    if "refresh_token" in data:
                        self.tokens.refresh_token = data["refresh_token"]
                else:
                    self.clear_tokens()
                    raise Exception("Token refresh failed")
        except Exception as error:
            self.clear_tokens()
            raise error

    def _get_cache_key(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> str:
        param_str = json.dumps(params, sort_keys=True) if params else ""
        return f"{endpoint}_{param_str}"

    def _get_from_cache(self, key: str) -> Optional[Any]:
        entry = self.cache.get(key)
        if not entry:
            return None

        now = time.time()
        if now - entry.timestamp > entry.ttl:
            del self.cache[key]
            return None

        return entry.data

    def _set_cache(self, key: str, data: Any, ttl: Optional[int] = None):
        cache_ttl = ttl or self.config.default_cache_ttl
        self.cache[key] = CacheEntry(data, time.time(), cache_ttl)

    async def _delay(self, ms: float):
        await asyncio.sleep(ms / 1000)

    async def _retry_request(self, request_func, attempt: int = 1):
        try:
            return await request_func()
        except ClientError as error:
            is_retryable_error = (
                hasattr(error, 'status') and error.status >= 500 or
                isinstance(error, (aiohttp.ClientConnectionError, asyncio.TimeoutError))
            )

            if attempt < self.config.retry_config.max_retries and is_retryable_error:
                delay_ms = min(
                    self.config.retry_config.base_delay * (2 ** (attempt - 1)) * 1000,
                    self.config.retry_config.max_delay * 1000
                )

                await self._delay(delay_ms)
                return await self._retry_request(request_func, attempt + 1)

            raise error

    async def get_bounties(self, filters: Optional[BountyFilters] = None, use_cache: bool = True) -> Dict[str, Any]:
        endpoint = "/bounties"
        params = filters.to_dict() if filters else None
        cache_key = self._get_cache_key(endpoint, params)

        if use_cache:
            cached = self._get_from_cache(cache_key)
            if cached:
                return cached

        try:
            async def request_func():
                session = await self._get_session()
                async with session.get(endpoint, params=params) as response:
                    response.raise_for_status()
                    return await response.json()

            data = await self._retry_request(request_func)
            self._set_cache(cache_key, data)
            return data
        except Exception as error:
            logger.error(f"Failed to fetch bounties: {error}")
            raise self._handle_api_error(error)

    async def get_bounty_by_id(self, bounty_id: str, use_cache: bool = True) -> Dict[str, Any]:
        endpoint = f"/bounties/{bounty_id}"
        cache_key = self._get_cache_key(endpoint)

        if use_cache:
            cached = self._get_from_cache(cache_key)
            if cached:
                return cached

        try:
            async def request_func():
                session = await self._get_session()
                async with session.get(endpoint) as response:
                    response.raise_for_status()
                    return await response.json()

            data = await self._retry_request(request_func)
            self._set_cache(cache_key, data, 120)  # 2 minute cache
            return data
        except Exception as error:
            logger.error(f"Failed to fetch bounty {bounty_id}: {error}")
            raise self._handle_api_error(error)

    async def create_bounty(self, bounty_data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            session = await self._get_session()
            async with session.post("/bounties", json=bounty_data) as response:
                response.raise_for_status()
                data = await response.json()

                # Invalidate bounties cache
                self.invalidate_cache("/bounties")
                return data
        except Exception as error:
            logger.error(f"Failed to create bounty: {error}")
            raise self._handle_api_error(error)

    async def update_bounty(self, bounty_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        try:
            session = await self._get_session()
            async with session.put(f"/bounties/{bounty_id}", json=updates) as response:
                response.raise_for_status()
                data = await response.json()

                # Invalidate related caches
                self.invalidate_cache("/bounties")
                self.invalidate_cache(f"/bounties/{bounty_id}")
                return data
        except Exception as error:
            logger.error(f"Failed to update bounty {bounty_id}: {error}")
            raise self._handle_api_error(error)

    async def get_leaderboard(self, filters: Optional[LeaderboardFilters] = None, use_cache: bool = True) -> Dict[str, Any]:
        endpoint = "/leaderboard"
        params = filters.to_dict() if filters else None
        cache_key = self._get_cache_key(endpoint, params)

        if use_cache:
            cached = self._get_from_cache(cache_key)
            if cached:
                return cached

        try:
            async def request_func():
                session = await self._get_session()
                async with session.get(endpoint, params=params) as response:
                    response.raise_for_status()
                    return await response.json()

            data = await self._retry_request(request_func)
            self._set_cache(cache_key, data, 180)  # 3 minute cache
            return data
        except Exception as error:
            logger.error(f"Failed to fetch leaderboard: {error}")
            raise self._handle_api_error(error)

    async def get_tokenomics(self, use_cache: bool = True) -> Dict[str, Any]:
        endpoint = "/tokenomics"
        cache_key = self._get_cache_key(endpoint)

        if use_cache:
            cached = self._get_from_cache(cache_key)
            if cached:
                return cached

        try:
            async def request_func():
                session = await self._get_session()
                async with session.get(endpoint) as response:
                    response.raise_for_status()
                    return await response.json()

            data = await self._retry_request(request_func)
            self._set_cache(cache_key, data, 600)  # 10 minute cache
            return data
        except Exception as error:
            logger.error(f"Failed to fetch tokenomics: {error}")
            raise self._handle_api_error(error)

    async def get_treasury_stats(self, use_cache: bool = True) -> Dict[str, Any]:
        endpoint = "/treasury/stats"
        cache_key = self._get_cache_key(endpoint)

        if use_cache:
            cached = self._get_from_cache(cache_key)
            if cached:
                return cached

        try:
            async def request_func():
                session = await self._get_session()
                async with session.get(endpoint) as response:
                    response.raise_for_status()
                    return await response.json()

            data = await self._retry_request(request_func)
            self._set_cache(cache_key, data, 300)  # 5 minute cache
            return data
        except Exception as error:
            logger.error(f"Failed to fetch treasury stats: {error}")
            raise self._handle_api_error(error)

    async def get_contributor(self, address: str, use_cache: bool = True) -> Dict[str, Any]:
        endpoint = f"/contributors/{address}"
        cache_key = self._get_cache_key(endpoint)

        if use_cache:
            cached = self._get_from_cache(cache_key)
            if cached:
                return cached

        try:
            async def request_func():
                session = await self._get_session()
                async with session.get(endpoint) as response:
                    response.raise_for_status()
                    return await response.json()

            data = await self._retry_request(request_func)
            self._set_cache(cache_key, data, 120)  # 2 minute cache
            return data
        except Exception as error:
            logger.error(f"Failed to fetch contributor {address}: {error}")
            raise self._handle_api_error(error)

    async def get_contributor_stats(self, address: str, use_cache: bool = True) -> Dict[str, Any]:
        endpoint = f"/contributors/{address}/stats"
        cache_key = self._get_cache_key(endpoint)

        if use_cache:
            cached = self._get_from_cache(cache_key)
            if cached:
                return cached

        try:
            async def request_func():
                session = await self._get_session()
                async with session.get(endpoint) as response:
                    response.raise_for_status()
                    return await response.json()

            data = await self._retry_request(request_func)
            self._set_cache(cache_key, data, 300)  # 5 minute cache
            return data
        except Exception as error:
            logger.error(f"Failed to fetch contributor stats {address}: {error}")
            raise self._handle_api_error(error)

    async def update_contributor_profile(self, address: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        try:
            session = await self._get_session()
            async with session.put(f"/contributors/{address}", json=updates) as response:
                response.raise_for_status()
                data = await response.json()

                # Invalidate contributor cache
                self.invalidate_cache(f"/contributors/{address}")
                return data
        except Exception as error:
            logger.error(f"Failed to update contributor profile {address}: {error}")
            raise self._handle_api_error(error)

    async def login(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        try:
            session = await self._get_session()
            async with session.post("/auth/login", json=credentials) as response:
                response.raise_for_status()
                data = await response.json()

                if "access_token" in data:
                    self.set_tokens(AuthTokens(
                        access_token=data["access_token"],
                        refresh_token=data.get("refresh_token")
                    ))

                return data
        except Exception as error:
            logger.error(f"Login failed: {error}")
            raise self._handle_api_error(error)

    async def logout(self):
        try:
            if self.tokens and self.tokens.refresh_token:
                session = await self._get_session()
                async with session.post("/auth/logout", json={"refresh_token": self.tokens.refresh_token}) as response:
                    pass  # Don't raise for status on logout
        except Exception as error:
            logger.error(f"Logout error: {error}")
        finally:
            self.clear_tokens()

    def invalidate_cache(self, pattern: str):
        keys_to_delete = [key for key in self.cache.keys() if pattern in key]
        for key in keys_to_delete:
            del self.cache[key]

    def clear_cache(self):
        self.cache.clear()

    def _handle_api_error(self, error: Exception) -> Exception:
        if hasattr(error, 'status'):
            status = error.status
            if status == 401:
                return Exception("Authentication required")
            elif status == 403:
                return Exception("Permission denied")
            elif status == 404:
                return Exception("Resource not found")
            elif status >= 500:
                return Exception("Server error - please try again later")

        if isinstance(error, (aiohttp.ClientConnectionError, asyncio.TimeoutError)):
            return Exception("Network error - please check your connection")

        return Exception(str(error) if str(error) else "An unexpected error occurred")

    async def health_check(self) -> bool:
        try:
            session = await self._get_session()
            async with session.get("/health") as response:
                return response.status == 200
        except Exception:
            return False

# Singleton instance
api_client = ApiClient()
