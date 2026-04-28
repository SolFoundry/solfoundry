"""Tests for review system API."""

import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from api.reviews import router, reviews_db, appeals_db
from models.review import (
    ReviewDashboard,
    LLMReview,
    ReviewConsensus,
    Appeal,
    AppealCreate,
)
from fastapi import FastAPI

app = FastAPI()
app.include_router(router)

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_dbs():
    """Clear databases before each test."""
    reviews_db.clear()
    appeals_db.clear()
    yield


def create_mock_dashboard(submission_id: str = 'test-123') -> ReviewDashboard:
    """Create a mock review dashboard."""
    return ReviewDashboard(
        submission_id=submission_id,
        reviews=[
            LLMReview(
                id='review-1',
                llm_provider='claude',
                score=85,
                reasoning='Good implementation',
                timestamp=datetime.utcnow(),
            ),
            LLMReview(
                id='review-2',
                llm_provider='codex',
                score=90,
                reasoning='Excellent work',
                timestamp=datetime.utcnow(),
            ),
            LLMReview(
                id='review-3',
                llm_provider='gemini',
                score=80,
                reasoning='Solid work',
                timestamp=datetime.utcnow(),
            ),
        ],
        consensus=ReviewConsensus(
            average_score=85.0,
            agreement_level='high',
            scores=[85, 90, 80],
            disagreements=[],
        ),
    )


class TestReviewDashboard:
    def test_create_review_dashboard(self):
        """Test creating a review dashboard."""
        dashboard = create_mock_dashboard()
        response = client.post('/api/reviews', json=dashboard.model_dump())
        
        assert response.status_code == 200
        data = response.json()
        assert data['submission_id'] == 'test-123'
        assert len(data['reviews']) == 3
        assert data['consensus']['average_score'] == 85.0

    def test_get_review_dashboard(self):
        """Test getting a review dashboard."""
        dashboard = create_mock_dashboard()
        client.post('/api/reviews', json=dashboard.model_dump())
        
        response = client.get('/api/reviews/test-123')
        assert response.status_code == 200
        data = response.json()
        assert data['submission_id'] == 'test-123'

    def test_get_nonexistent_dashboard(self):
        """Test getting a nonexistent dashboard."""
        response = client.get('/api/reviews/nonexistent')
        assert response.status_code == 404


class TestAppeals:
    def test_create_appeal(self):
        """Test creating an appeal."""
        appeal_data = AppealCreate(
            submission_id='test-123',
            reason='Disagree with review scores',
        )
        
        response = client.post('/api/appeals', json=appeal_data.model_dump())
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'pending'
        assert data['submission_id'] == 'test-123'
        assert len(data['history']) == 1

    def test_get_appeal(self):
        """Test getting an appeal."""
        appeal_data = AppealCreate(
            submission_id='test-123',
            reason='Test reason',
        )
        
        create_response = client.post('/api/appeals', json=appeal_data.model_dump())
        appeal_id = create_response.json()['id']
        
        response = client.get(f'/api/appeals/{appeal_id}')
        assert response.status_code == 200
        assert response.json()['id'] == appeal_id

    def test_update_appeal_status(self):
        """Test updating appeal status."""
        appeal_data = AppealCreate(
            submission_id='test-123',
            reason='Test reason',
        )
        
        create_response = client.post('/api/appeals', json=appeal_data.model_dump())
        appeal_id = create_response.json()['id']
        
        update_response = client.patch(
            f'/api/appeals/{appeal_id}/status',
            json={'status': 'under_review', 'notes': 'Started review'},
        )
        
        assert update_response.status_code == 200
        assert update_response.json()['status'] == 'under_review'
        assert len(update_response.json()['history']) == 2

    def test_assign_reviewer(self):
        """Test assigning a reviewer to an appeal."""
        appeal_data = AppealCreate(
            submission_id='test-123',
            reason='Test reason',
        )
        
        create_response = client.post('/api/appeals', json=appeal_data.model_dump())
        appeal_id = create_response.json()['id']
        
        assign_response = client.post(
            f'/api/appeals/{appeal_id}/assign',
            json={'reviewer_id': 'reviewer-123'},
        )
        
        assert assign_response.status_code == 200
        assert assign_response.json()['reviewer_id'] == 'reviewer-123'


class TestConsensusCalculation:
    def test_high_agreement(self):
        """Test high agreement consensus."""
        from api.reviews import calculate_consensus
        
        reviews = [
            LLMReview(
                id='1',
                llm_provider='claude',
                score=85,
                reasoning='Good',
                timestamp=datetime.utcnow(),
            ),
            LLMReview(
                id='2',
                llm_provider='codex',
                score=87,
                reasoning='Good',
                timestamp=datetime.utcnow(),
            ),
            LLMReview(
                id='3',
                llm_provider='gemini',
                score=83,
                reasoning='Good',
                timestamp=datetime.utcnow(),
            ),
        ]
        
        consensus = calculate_consensus(reviews)
        assert consensus.agreement_level == 'high'
        assert len(consensus.disagreements) == 0

    def test_low_agreement(self):
        """Test low agreement consensus."""
        from api.reviews import calculate_consensus
        
        reviews = [
            LLMReview(
                id='1',
                llm_provider='claude',
                score=95,
                reasoning='Excellent',
                timestamp=datetime.utcnow(),
            ),
            LLMReview(
                id='2',
                llm_provider='codex',
                score=50,
                reasoning='Poor',
                timestamp=datetime.utcnow(),
            ),
            LLMReview(
                id='3',
                llm_provider='gemini',
                score=90,
                reasoning='Good',
                timestamp=datetime.utcnow(),
            ),
        ]
        
        consensus = calculate_consensus(reviews)
        assert consensus.agreement_level == 'low'
        assert len(consensus.disagreements) > 0
