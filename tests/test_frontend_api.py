import pytest
import json
from unittest.mock import patch, Mock
from datetime import datetime, timezone
import os
import sys

# Add backend to Python path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app import create_app
from models import db, User, Bounty, Contribution


@pytest.fixture
def app():
    """Create test application with isolated database."""
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Test client for making requests."""
    return app.test_client()


@pytest.fixture
def auth_headers():
    """Mock JWT token for authenticated requests."""
    return {'Authorization': 'Bearer mock_jwt_token'}


@pytest.fixture
def sample_user(app):
    """Create sample user for testing."""
    with app.app_context():
        user = User(
            github_username='testuser',
            wallet_address='9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
            tier=1,
            reputation_score=150,
            total_earned=25000
        )
        db.session.add(user)
        db.session.commit()
        return user


@pytest.fixture
def sample_bounties(app, sample_user):
    """Create sample bounties for testing."""
    with app.app_context():
        bounties = [
            Bounty(
                title='Frontend Bug Fix',
                description='Fix loading spinner issue',
                reward_amount=50000,
                tier=1,
                status='open',
                tags='frontend,bug',
                created_by=sample_user.id
            ),
            Bounty(
                title='API Integration',
                description='Connect payment endpoints',
                reward_amount=150000,
                tier=2,
                status='in_progress',
                tags='backend,api',
                assignee_id=sample_user.id,
                created_by=sample_user.id
            ),
            Bounty(
                title='Smart Contract Audit',
                description='Security review of token contract',
                reward_amount=500000,
                tier=3,
                status='completed',
                tags='solana,security',
                created_by=sample_user.id
            )
        ]
        for bounty in bounties:
            db.session.add(bounty)
        db.session.commit()
        return bounties


class TestBountiesEndpoint:
    """Test /api/bounties endpoint functionality."""

    def test_get_bounties_success(self, client, sample_bounties):
        """Test successful retrieval of bounties list."""
        response = client.get('/api/bounties')
        assert response.status_code == 200

        data = json.loads(response.data)
        assert 'bounties' in data
        assert len(data['bounties']) == 3

        # Check bounty structure
        bounty = data['bounties'][0]
        required_fields = ['id', 'title', 'description', 'reward_amount',
                          'tier', 'status', 'tags', 'created_at']
        for field in required_fields:
            assert field in bounty

    def test_get_bounties_with_filters(self, client, sample_bounties):
        """Test bounties filtering by status and tier."""
        # Filter by status
        response = client.get('/api/bounties?status=open')
        data = json.loads(response.data)
        assert len(data['bounties']) == 1
        assert data['bounties'][0]['status'] == 'open'

        # Filter by tier
        response = client.get('/api/bounties?tier=2')
        data = json.loads(response.data)
        assert len(data['bounties']) == 1
        assert data['bounties'][0]['tier'] == 2

    def test_get_bounties_pagination(self, client, app):
        """Test bounties pagination parameters."""
        with app.app_context():
            # Create 15 bounties
            for i in range(15):
                bounty = Bounty(
                    title=f'Bounty {i}',
                    description=f'Description {i}',
                    reward_amount=10000 * (i + 1),
                    tier=1,
                    status='open',
                    created_by=1
                )
                db.session.add(bounty)
            db.session.commit()

        # Test pagination
        response = client.get('/api/bounties?page=1&limit=10')
        data = json.loads(response.data)
        assert len(data['bounties']) == 10
        assert 'total_count' in data
        assert 'page' in data
        assert 'has_more' in data

    def test_get_single_bounty(self, client, sample_bounties):
        """Test retrieving individual bounty details."""
        bounty_id = sample_bounties[0].id
        response = client.get(f'/api/bounties/{bounty_id}')
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['id'] == bounty_id
        assert data['title'] == 'Frontend Bug Fix'

    def test_get_nonexistent_bounty(self, client):
        """Test 404 for non-existent bounty."""
        response = client.get('/api/bounties/99999')
        assert response.status_code == 404

        data = json.loads(response.data)
        assert 'error' in data

    @patch('auth.verify_jwt_token')
    def test_create_bounty_authenticated(self, mock_auth, client, auth_headers, sample_user):
        """Test creating new bounty with authentication."""
        mock_auth.return_value = {'user_id': sample_user.id}

        bounty_data = {
            'title': 'New API Endpoint',
            'description': 'Build user profile endpoint',
            'reward_amount': 75000,
            'tier': 2,
            'tags': 'backend,api'
        }

        response = client.post('/api/bounties',
                             json=bounty_data,
                             headers=auth_headers)
        assert response.status_code == 201

        data = json.loads(response.data)
        assert data['title'] == bounty_data['title']
        assert data['status'] == 'open'

    def test_create_bounty_unauthorized(self, client):
        """Test creating bounty without authentication."""
        bounty_data = {
            'title': 'Unauthorized Bounty',
            'reward_amount': 50000
        }

        response = client.post('/api/bounties', json=bounty_data)
        assert response.status_code == 401

    def test_create_bounty_invalid_data(self, client, auth_headers):
        """Test bounty creation with invalid data."""
        with patch('auth.verify_jwt_token') as mock_auth:
            mock_auth.return_value = {'user_id': 1}

            # Missing required fields
            invalid_data = {'title': 'Incomplete'}
            response = client.post('/api/bounties',
                                 json=invalid_data,
                                 headers=auth_headers)
            assert response.status_code == 400


class TestLeaderboardEndpoint:
    """Test /api/leaderboard endpoint functionality."""

    def test_get_leaderboard_success(self, client, app):
        """Test successful leaderboard retrieval."""
        with app.app_context():
            # Create users with different scores
            users = [
                User(github_username='user1', reputation_score=500, total_earned=100000),
                User(github_username='user2', reputation_score=300, total_earned=75000),
                User(github_username='user3', reputation_score=800, total_earned=200000)
            ]
            for user in users:
                db.session.add(user)
            db.session.commit()

        response = client.get('/api/leaderboard')
        assert response.status_code == 200

        data = json.loads(response.data)
        assert 'leaderboard' in data
        assert len(data['leaderboard']) == 3

        # Check sorting by reputation (highest first)
        assert data['leaderboard'][0]['reputation_score'] == 800
        assert data['leaderboard'][1]['reputation_score'] == 500

    def test_leaderboard_time_filter(self, client, app):
        """Test leaderboard with time period filters."""
        response = client.get('/api/leaderboard?period=30d')
        assert response.status_code == 200

        data = json.loads(response.data)
        assert 'period' in data
        assert data['period'] == '30d'

    def test_leaderboard_empty(self, client):
        """Test leaderboard with no users."""
        response = client.get('/api/leaderboard')
        data = json.loads(response.data)
        assert data['leaderboard'] == []


class TestTokenomicsEndpoint:
    """Test /api/tokenomics endpoint functionality."""

    def test_get_tokenomics_success(self, client, app):
        """Test tokenomics data retrieval."""
        response = client.get('/api/tokenomics')
        assert response.status_code == 200

        data = json.loads(response.data)
        required_fields = ['total_supply', 'circulating_supply', 'treasury_balance',
                          'total_rewards_paid', 'active_bounties_value']
        for field in required_fields:
            assert field in data

    @patch('services.treasury_service.get_treasury_balance')
    def test_tokenomics_with_treasury_data(self, mock_treasury, client):
        """Test tokenomics with real treasury integration."""
        mock_treasury.return_value = {
            'balance': 5000000,
            'pending_rewards': 250000
        }

        response = client.get('/api/tokenomics')
        data = json.loads(response.data)
        assert data['treasury_balance'] == 5000000


class TestContributorEndpoint:
    """Test /api/contributors endpoint functionality."""

    @patch('auth.verify_jwt_token')
    def test_get_contributor_profile(self, mock_auth, client, auth_headers, sample_user):
        """Test authenticated user profile retrieval."""
        mock_auth.return_value = {'user_id': sample_user.id}

        response = client.get('/api/contributors/me', headers=auth_headers)
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['github_username'] == 'testuser'
        assert data['tier'] == 1
        assert data['reputation_score'] == 150

    def test_get_contributor_profile_unauthorized(self, client):
        """Test profile access without authentication."""
        response = client.get('/api/contributors/me')
        assert response.status_code == 401

    def test_get_public_contributor_profile(self, client, sample_user):
        """Test public contributor profile by username."""
        response = client.get(f'/api/contributors/{sample_user.github_username}')
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['github_username'] == 'testuser'
        # Sensitive data should not be included
        assert 'wallet_address' not in data

    def test_get_contributor_contributions(self, client, app, sample_user):
        """Test retrieving contributor's contributions history."""
        with app.app_context():
            contribution = Contribution(
                user_id=sample_user.id,
                bounty_id=1,
                amount=50000,
                contribution_type='completion',
                status='approved'
            )
            db.session.add(contribution)
            db.session.commit()

        response = client.get(f'/api/contributors/{sample_user.github_username}/contributions')
        assert response.status_code == 200

        data = json.loads(response.data)
        assert 'contributions' in data
        assert len(data['contributions']) >= 1


class TestErrorHandling:
    """Test API error handling and validation."""

    def test_invalid_json_request(self, client):
        """Test handling of malformed JSON requests."""
        response = client.post('/api/bounties',
                             data='invalid json',
                             content_type='application/json')
        assert response.status_code == 400

        data = json.loads(response.data)
        assert 'error' in data

    def test_missing_content_type(self, client):
        """Test requests without proper content type."""
        response = client.post('/api/bounties', data='{}')
        assert response.status_code == 400

    def test_rate_limiting(self, client):
        """Test API rate limiting (if implemented)."""
        # Make many requests rapidly
        responses = []
        for _ in range(100):
            response = client.get('/api/bounties')
            responses.append(response.status_code)

        # Should have some successful requests
        assert 200 in responses

    def test_large_payload_handling(self, client, auth_headers):
        """Test handling of oversized request payloads."""
        with patch('auth.verify_jwt_token') as mock_auth:
            mock_auth.return_value = {'user_id': 1}

            large_data = {
                'title': 'A' * 10000,  # Very long title
                'description': 'B' * 50000,  # Very long description
                'reward_amount': 50000
            }

            response = client.post('/api/bounties',
                                 json=large_data,
                                 headers=auth_headers)
            assert response.status_code == 400


class TestCaching:
    """Test API response caching behavior."""

    def test_bounties_cache_headers(self, client, sample_bounties):
        """Test proper cache headers on bounties endpoint."""
        response = client.get('/api/bounties')

        # Check for caching headers
        assert 'Cache-Control' in response.headers

    def test_leaderboard_cache_invalidation(self, client, app):
        """Test cache invalidation after data changes."""
        # Initial request
        response1 = client.get('/api/leaderboard')
        etag1 = response1.headers.get('ETag')

        # Modify data
        with app.app_context():
            user = User(github_username='newuser', reputation_score=999)
            db.session.add(user)
            db.session.commit()

        # Second request should have different ETag
        response2 = client.get('/api/leaderboard')
        etag2 = response2.headers.get('ETag')

        if etag1 and etag2:
            assert etag1 != etag2


class TestDataValidation:
    """Test input validation and data integrity."""

    def test_bounty_reward_validation(self, client, auth_headers):
        """Test bounty reward amount validation."""
        with patch('auth.verify_jwt_token') as mock_auth:
            mock_auth.return_value = {'user_id': 1}

            # Negative reward
            invalid_data = {
                'title': 'Test Bounty',
                'description': 'Test description',
                'reward_amount': -1000,
                'tier': 1
            }

            response = client.post('/api/bounties',
                                 json=invalid_data,
                                 headers=auth_headers)
            assert response.status_code == 400

    def test_tier_validation(self, client, auth_headers):
        """Test tier value validation."""
        with patch('auth.verify_jwt_token') as mock_auth:
            mock_auth.return_value = {'user_id': 1}

            # Invalid tier
            invalid_data = {
                'title': 'Test Bounty',
                'description': 'Test description',
                'reward_amount': 50000,
                'tier': 99  # Invalid tier
            }

            response = client.post('/api/bounties',
                                 json=invalid_data,
                                 headers=auth_headers)
            assert response.status_code == 400

    def test_sql_injection_protection(self, client):
        """Test protection against SQL injection attacks."""
        malicious_query = "'; DROP TABLE bounties; --"

        response = client.get(f'/api/bounties?status={malicious_query}')
        # Should not crash and should return valid response
        assert response.status_code in [200, 400]  # Either works or rejects safely
