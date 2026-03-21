import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
import aiohttp
import json
from datetime import datetime, timedelta

from backend.services.api_client import APIClient, APIError, RateLimitError, AuthenticationError


class TestAPIClient:
    """Test suite for API client service"""

    @pytest.fixture
    def api_client(self):
        return APIClient(
            base_url="https://api.test.com",
            api_key="test_key_123",
            timeout=30
        )

    @pytest.fixture
    def mock_session(self):
        session = Mock()
        session.get = AsyncMock()
        session.post = AsyncMock()
        session.put = AsyncMock()
        session.delete = AsyncMock()
        session.close = AsyncMock()
        return session

    @pytest.mark.asyncio
    async def test_initialization(self, api_client):
        assert api_client.base_url == "https://api.test.com"
        assert api_client.api_key == "test_key_123"
        assert api_client.timeout == 30
        assert api_client._cache == {}
        assert api_client._session is None

    @pytest.mark.asyncio
    async def test_get_session_creates_new_session(self, api_client):
        with patch('aiohttp.ClientSession') as mock_client:
            mock_session = Mock()
            mock_client.return_value = mock_session

            session = await api_client._get_session()

            assert session == mock_session
            assert api_client._session == mock_session
            mock_client.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_session_reuses_existing(self, api_client, mock_session):
        api_client._session = mock_session

        session = await api_client._get_session()

        assert session == mock_session

    @pytest.mark.asyncio
    async def test_build_headers_with_auth(self, api_client):
        headers = api_client._build_headers()

        expected = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_key_123',
            'User-Agent': 'SolFoundry-API-Client/1.0'
        }
        assert headers == expected

    @pytest.mark.asyncio
    async def test_build_headers_without_auth(self):
        client = APIClient(base_url="https://api.test.com")
        headers = client._build_headers()

        expected = {
            'Content-Type': 'application/json',
            'User-Agent': 'SolFoundry-API-Client/1.0'
        }
        assert headers == expected

    @pytest.mark.asyncio
    async def test_build_headers_with_custom(self, api_client):
        custom_headers = {'X-Custom': 'value', 'Content-Type': 'text/plain'}
        headers = api_client._build_headers(custom_headers)

        assert headers['X-Custom'] == 'value'
        assert headers['Content-Type'] == 'text/plain'
        assert headers['Authorization'] == 'Bearer test_key_123'

    def test_get_cache_key(self, api_client):
        key = api_client._get_cache_key('/bounties', {'status': 'open'})
        expected = 'GET:/bounties?status=open'
        assert key == expected

    def test_is_cache_valid_fresh_entry(self, api_client):
        api_client._cache['test'] = {
            'data': {'result': 'data'},
            'timestamp': datetime.now(),
            'ttl': 300
        }

        assert api_client._is_cache_valid('test') is True

    def test_is_cache_valid_expired_entry(self, api_client):
        api_client._cache['test'] = {
            'data': {'result': 'data'},
            'timestamp': datetime.now() - timedelta(seconds=400),
            'ttl': 300
        }

        assert api_client._is_cache_valid('test') is False

    def test_is_cache_valid_missing_entry(self, api_client):
        assert api_client._is_cache_valid('nonexistent') is False

    @pytest.mark.asyncio
    async def test_request_successful_json_response(self, api_client, mock_session):
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={'data': 'test'})
        mock_response.text = AsyncMock(return_value='{"data": "test"}')
        mock_session.get.return_value.__aenter__.return_value = mock_response

        api_client._session = mock_session

        result = await api_client._request('GET', '/test')

        assert result == {'data': 'test'}
        mock_session.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_request_404_error(self, api_client, mock_session):
        mock_response = Mock()
        mock_response.status = 404
        mock_response.text = AsyncMock(return_value='Not Found')
        mock_session.get.return_value.__aenter__.return_value = mock_response

        api_client._session = mock_session

        with pytest.raises(APIError) as exc_info:
            await api_client._request('GET', '/nonexistent')

        assert exc_info.value.status_code == 404
        assert 'Not Found' in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_request_401_auth_error(self, api_client, mock_session):
        mock_response = Mock()
        mock_response.status = 401
        mock_response.text = AsyncMock(return_value='Unauthorized')
        mock_session.get.return_value.__aenter__.return_value = mock_response

        api_client._session = mock_session

        with pytest.raises(AuthenticationError):
            await api_client._request('GET', '/protected')

    @pytest.mark.asyncio
    async def test_request_429_rate_limit_error(self, api_client, mock_session):
        mock_response = Mock()
        mock_response.status = 429
        mock_response.text = AsyncMock(return_value='Rate Limited')
        mock_response.headers = {'Retry-After': '60'}
        mock_session.get.return_value.__aenter__.return_value = mock_response

        api_client._session = mock_session

        with pytest.raises(RateLimitError) as exc_info:
            await api_client._request('GET', '/test')

        assert exc_info.value.retry_after == 60

    @pytest.mark.asyncio
    async def test_request_with_retry_success_after_failure(self, api_client, mock_session):
        # First call fails, second succeeds
        mock_response_fail = Mock()
        mock_response_fail.status = 500
        mock_response_fail.text = AsyncMock(return_value='Server Error')

        mock_response_success = Mock()
        mock_response_success.status = 200
        mock_response_success.json = AsyncMock(return_value={'data': 'success'})

        mock_session.get.return_value.__aenter__.side_effect = [
            mock_response_fail,
            mock_response_success
        ]

        api_client._session = mock_session

        with patch('asyncio.sleep'):
            result = await api_client._request('GET', '/test', max_retries=2)

        assert result == {'data': 'success'}
        assert mock_session.get.call_count == 2

    @pytest.mark.asyncio
    async def test_request_exhausted_retries(self, api_client, mock_session):
        mock_response = Mock()
        mock_response.status = 500
        mock_response.text = AsyncMock(return_value='Server Error')
        mock_session.get.return_value.__aenter__.return_value = mock_response

        api_client._session = mock_session

        with patch('asyncio.sleep'):
            with pytest.raises(APIError) as exc_info:
                await api_client._request('GET', '/test', max_retries=2)

        assert exc_info.value.status_code == 500
        assert mock_session.get.call_count == 3  # Initial + 2 retries

    @pytest.mark.asyncio
    async def test_get_cached_response(self, api_client):
        # Setup cache
        cache_key = 'GET:/bounties'
        api_client._cache[cache_key] = {
            'data': {'bounties': []},
            'timestamp': datetime.now(),
            'ttl': 300
        }

        with patch.object(api_client, '_request') as mock_request:
            result = await api_client.get('/bounties')

        assert result == {'bounties': []}
        mock_request.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_with_caching_enabled(self, api_client):
        with patch.object(api_client, '_request', return_value={'data': 'test'}):
            result = await api_client.get('/test', use_cache=True, cache_ttl=600)

        cache_key = 'GET:/test'
        assert cache_key in api_client._cache
        assert api_client._cache[cache_key]['data'] == {'data': 'test'}
        assert api_client._cache[cache_key]['ttl'] == 600
        assert result == {'data': 'test'}

    @pytest.mark.asyncio
    async def test_post_with_data(self, api_client):
        test_data = {'name': 'Test Bounty', 'amount': 1000}

        with patch.object(api_client, '_request', return_value={'id': 123}) as mock_request:
            result = await api_client.post('/bounties', data=test_data)

        mock_request.assert_called_once_with('POST', '/bounties', data=test_data, max_retries=3)
        assert result == {'id': 123}

    @pytest.mark.asyncio
    async def test_put_request(self, api_client):
        update_data = {'status': 'completed'}

        with patch.object(api_client, '_request', return_value={'updated': True}) as mock_request:
            result = await api_client.put('/bounties/123', data=update_data)

        mock_request.assert_called_once_with('PUT', '/bounties/123', data=update_data, max_retries=3)
        assert result == {'updated': True}

    @pytest.mark.asyncio
    async def test_delete_request(self, api_client):
        with patch.object(api_client, '_request', return_value={'deleted': True}) as mock_request:
            result = await api_client.delete('/bounties/123')

        mock_request.assert_called_once_with('DELETE', '/bounties/123', max_retries=3)
        assert result == {'deleted': True}

    @pytest.mark.asyncio
    async def test_fetch_bounties(self, api_client):
        mock_bounties = [
            {'id': 1, 'title': 'Test Bounty', 'amount': 1000},
            {'id': 2, 'title': 'Another Bounty', 'amount': 500}
        ]

        with patch.object(api_client, 'get', return_value={'bounties': mock_bounties}) as mock_get:
            result = await api_client.fetch_bounties(status='open', limit=10)

        mock_get.assert_called_once_with('/bounties', params={'status': 'open', 'limit': 10}, use_cache=True, cache_ttl=300)
        assert result == mock_bounties

    @pytest.mark.asyncio
    async def test_fetch_bounty_by_id(self, api_client):
        mock_bounty = {'id': 123, 'title': 'Specific Bounty', 'amount': 2000}

        with patch.object(api_client, 'get', return_value=mock_bounty) as mock_get:
            result = await api_client.fetch_bounty(123)

        mock_get.assert_called_once_with('/bounties/123', use_cache=True, cache_ttl=600)
        assert result == mock_bounty

    @pytest.mark.asyncio
    async def test_fetch_leaderboard(self, api_client):
        mock_leaderboard = [
            {'user': 'alice', 'points': 5000, 'rank': 1},
            {'user': 'bob', 'points': 3500, 'rank': 2}
        ]

        with patch.object(api_client, 'get', return_value={'leaderboard': mock_leaderboard}) as mock_get:
            result = await api_client.fetch_leaderboard(timeframe='month', limit=50)

        mock_get.assert_called_once_with('/leaderboard', params={'timeframe': 'month', 'limit': 50}, use_cache=True, cache_ttl=180)
        assert result == mock_leaderboard

    @pytest.mark.asyncio
    async def test_fetch_tokenomics(self, api_client):
        mock_tokenomics = {
            'total_supply': 1000000000,
            'circulating_supply': 500000000,
            'treasury_balance': 50000000
        }

        with patch.object(api_client, 'get', return_value=mock_tokenomics) as mock_get:
            result = await api_client.fetch_tokenomics()

        mock_get.assert_called_once_with('/tokenomics', use_cache=True, cache_ttl=900)
        assert result == mock_tokenomics

    @pytest.mark.asyncio
    async def test_fetch_contributor_profile(self, api_client):
        mock_profile = {
            'id': 456,
            'username': 'developer123',
            'bounties_completed': 15,
            'total_earned': 25000
        }

        with patch.object(api_client, 'get', return_value=mock_profile) as mock_get:
            result = await api_client.fetch_contributor_profile('developer123')

        mock_get.assert_called_once_with('/contributors/developer123', use_cache=True, cache_ttl=600)
        assert result == mock_profile

    @pytest.mark.asyncio
    async def test_submit_bounty_solution(self, api_client):
        solution_data = {
            'bounty_id': 123,
            'solution_url': 'https://github.com/user/repo/pull/456',
            'description': 'My solution implementation'
        }
        mock_response = {'submission_id': 789, 'status': 'pending_review'}

        with patch.object(api_client, 'post', return_value=mock_response) as mock_post:
            result = await api_client.submit_bounty_solution(123, solution_data)

        mock_post.assert_called_once_with('/bounties/123/submissions', data=solution_data)
        assert result == mock_response

    @pytest.mark.asyncio
    async def test_update_bounty_status(self, api_client):
        mock_response = {'id': 123, 'status': 'in_progress', 'updated_at': '2024-01-15T10:00:00Z'}

        with patch.object(api_client, 'put', return_value=mock_response) as mock_put:
            result = await api_client.update_bounty_status(123, 'in_progress')

        mock_put.assert_called_once_with('/bounties/123', data={'status': 'in_progress'})
        assert result == mock_response

    @pytest.mark.asyncio
    async def test_clear_cache(self, api_client):
        # Setup some cache entries
        api_client._cache = {
            'key1': {'data': 'value1', 'timestamp': datetime.now(), 'ttl': 300},
            'key2': {'data': 'value2', 'timestamp': datetime.now(), 'ttl': 300}
        }

        api_client.clear_cache()

        assert api_client._cache == {}

    @pytest.mark.asyncio
    async def test_close_session(self, api_client, mock_session):
        api_client._session = mock_session

        await api_client.close()

        mock_session.close.assert_called_once()
        assert api_client._session is None

    @pytest.mark.asyncio
    async def test_context_manager(self, api_client):
        with patch.object(api_client, 'close') as mock_close:
            async with api_client:
                pass

            mock_close.assert_called_once()

    @pytest.mark.asyncio
    async def test_connection_error_handling(self, api_client, mock_session):
        mock_session.get.side_effect = aiohttp.ClientConnectorError(connection_key='test', os_error=None)
        api_client._session = mock_session

        with pytest.raises(APIError) as exc_info:
            await api_client._request('GET', '/test')

        assert 'Connection error' in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_timeout_error_handling(self, api_client, mock_session):
        mock_session.get.side_effect = asyncio.TimeoutError()
        api_client._session = mock_session

        with pytest.raises(APIError) as exc_info:
            await api_client._request('GET', '/test')

        assert 'Request timeout' in str(exc_info.value)

    def test_cache_cleanup_expired_entries(self, api_client):
        now = datetime.now()
        api_client._cache = {
            'fresh': {
                'data': 'value1',
                'timestamp': now,
                'ttl': 300
            },
            'expired': {
                'data': 'value2',
                'timestamp': now - timedelta(seconds=400),
                'ttl': 300
            }
        }

        api_client._cleanup_cache()

        assert 'fresh' in api_client._cache
        assert 'expired' not in api_client._cache

    @pytest.mark.asyncio
    async def test_batch_requests_success(self, api_client):
        requests = [
            {'method': 'GET', 'endpoint': '/bounties/1'},
            {'method': 'GET', 'endpoint': '/bounties/2'},
            {'method': 'GET', 'endpoint': '/bounties/3'}
        ]

        with patch.object(api_client, '_request', side_effect=[
            {'id': 1, 'title': 'Bounty 1'},
            {'id': 2, 'title': 'Bounty 2'},
            {'id': 3, 'title': 'Bounty 3'}
        ]) as mock_request:
            results = await api_client.batch_requests(requests)

        assert len(results) == 3
        assert all('id' in result for result in results)
        assert mock_request.call_count == 3

    @pytest.mark.asyncio
    async def test_health_check(self, api_client):
        mock_health = {'status': 'healthy', 'timestamp': '2024-01-15T10:00:00Z'}

        with patch.object(api_client, 'get', return_value=mock_health) as mock_get:
            result = await api_client.health_check()

        mock_get.assert_called_once_with('/health', use_cache=False)
        assert result == mock_health
