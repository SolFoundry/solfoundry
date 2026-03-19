import pytest
import hmac
import hashlib
import json
from unittest.mock import patch, MagicMock
from app import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['GITHUB_WEBHOOK_SECRET'] = 'test_secret'
    with app.test_client() as client:
        yield client


def generate_signature(payload, secret):
    """Generate GitHub webhook signature for testing"""
    signature = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return f"sha256={signature}"


class TestWebhookEndpoint:
    
    def test_webhook_missing_signature(self, client):
        payload = {"test": "data"}
        response = client.post('/webhook', 
                             data=json.dumps(payload),
                             content_type='application/json')
        assert response.status_code == 401
        assert "Missing signature" in response.get_json()["error"]
    
    def test_webhook_invalid_signature(self, client):
        payload = {"test": "data"}
        headers = {
            'X-Hub-Signature-256': 'sha256=invalid_signature',
            'X-GitHub-Event': 'push'
        }
        response = client.post('/webhook',
                             data=json.dumps(payload),
                             headers=headers,
                             content_type='application/json')
        assert response.status_code == 401
        assert "Invalid signature" in response.get_json()["error"]
    
    def test_webhook_valid_signature(self, client):
        payload = {"test": "data"}
        payload_str = json.dumps(payload)
        signature = generate_signature(payload_str, 'test_secret')
        
        headers = {
            'X-Hub-Signature-256': signature,
            'X-GitHub-Event': 'push',
            'X-GitHub-Delivery': 'test-delivery-123'
        }
        
        with patch('app.process_webhook') as mock_process:
            mock_process.return_value = True
            response = client.post('/webhook',
                                 data=payload_str,
                                 headers=headers,
                                 content_type='application/json')
            assert response.status_code == 200
            mock_process.assert_called_once()
    
    def test_webhook_push_event(self, client):
        payload = {
            "ref": "refs/heads/main",
            "repository": {
                "full_name": "test/repo"
            },
            "commits": [
                {
                    "id": "abc123",
                    "message": "Test commit"
                }
            ]
        }
        payload_str = json.dumps(payload)
        signature = generate_signature(payload_str, 'test_secret')
        
        headers = {
            'X-Hub-Signature-256': signature,
            'X-GitHub-Event': 'push',
            'X-GitHub-Delivery': 'test-delivery-123'
        }
        
        with patch('app.process_webhook') as mock_process:
            mock_process.return_value = True
            response = client.post('/webhook',
                                 data=payload_str,
                                 headers=headers,
                                 content_type='application/json')
            assert response.status_code == 200
            call_args = mock_process.call_args[0]
            assert call_args[0] == 'push'
            assert call_args[1]['repository']['full_name'] == 'test/repo'
    
    def test_webhook_pull_request_event(self, client):
        payload = {
            "action": "opened",
            "pull_request": {
                "number": 123,
                "title": "Test PR",
                "head": {"sha": "abc123"},
                "base": {"ref": "main"}
            },
            "repository": {
                "full_name": "test/repo"
            }
        }
        payload_str = json.dumps(payload)
        signature = generate_signature(payload_str, 'test_secret')
        
        headers = {
            'X-Hub-Signature-256': signature,
            'X-GitHub-Event': 'pull_request',
            'X-GitHub-Delivery': 'test-delivery-123'
        }
        
        with patch('app.process_webhook') as mock_process:
            mock_process.return_value = True
            response = client.post('/webhook',
                                 data=payload_str,
                                 headers=headers,
                                 content_type='application/json')
            assert response.status_code == 200
            call_args = mock_process.call_args[0]
            assert call_args[0] == 'pull_request'
            assert call_args[1]['action'] == 'opened'
    
    def test_webhook_issues_event(self, client):
        payload = {
            "action": "opened",
            "issue": {
                "number": 456,
                "title": "Test Issue",
                "state": "open"
            },
            "repository": {
                "full_name": "test/repo"
            }
        }
        payload_str = json.dumps(payload)
        signature = generate_signature(payload_str, 'test_secret')
        
        headers = {
            'X-Hub-Signature-256': signature,
            'X-GitHub-Event': 'issues',
            'X-GitHub-Delivery': 'test-delivery-123'
        }
        
        with patch('app.process_webhook') as mock_process:
            mock_process.return_value = True
            response = client.post('/webhook',
                                 data=payload_str,
                                 headers=headers,
                                 content_type='application/json')
            assert response.status_code == 200
            call_args = mock_process.call_args[0]
            assert call_args[0] == 'issues'
            assert call_args[1]['action'] == 'opened'


class TestSignatureVerification:
    
    def test_verify_signature_valid(self):
        from app import verify_signature
        payload = '{"test": "data"}'
        secret = 'test_secret'
        signature = generate_signature(payload, secret)
        
        assert verify_signature(payload, signature, secret) is True
    
    def test_verify_signature_invalid(self):
        from app import verify_signature
        payload = '{"test": "data"}'
        secret = 'test_secret'
        signature = 'sha256=invalid_signature'
        
        assert verify_signature(payload, signature, secret) is False
    
    def test_verify_signature_wrong_format(self):
        from app import verify_signature
        payload = '{"test": "data"}'
        secret = 'test_secret'
        signature = 'invalid_format'
        
        assert verify_signature(payload, signature, secret) is False
    
    def test_verify_signature_empty_secret(self):
        from app import verify_signature
        payload = '{"test": "data"}'
        secret = ''
        signature = generate_signature(payload, 'test')
        
        assert verify_signature(payload, signature, secret) is False


class TestIdempotency:
    
    def test_webhook_duplicate_delivery_id(self, client):
        payload = {"test": "data"}
        payload_str = json.dumps(payload)
        signature = generate_signature(payload_str, 'test_secret')
        
        headers = {
            'X-Hub-Signature-256': signature,
            'X-GitHub-Event': 'push',
            'X-GitHub-Delivery': 'duplicate-delivery-123'
        }
        
        with patch('app.process_webhook') as mock_process, \
             patch('app.is_duplicate_delivery') as mock_duplicate:
            
            # First request - not duplicate
            mock_duplicate.return_value = False
            mock_process.return_value = True
            
            response1 = client.post('/webhook',
                                  data=payload_str,
                                  headers=headers,
                                  content_type='application/json')
            assert response1.status_code == 200
            mock_process.assert_called_once()
            
            # Second request - duplicate
            mock_duplicate.return_value = True
            mock_process.reset_mock()
            
            response2 = client.post('/webhook',
                                  data=payload_str,
                                  headers=headers,
                                  content_type='application/json')
            assert response2.status_code == 200
            assert "already processed" in response2.get_json()["message"]
            mock_process.assert_not_called()
    
    def test_webhook_different_delivery_ids(self, client):
        payload = {"test": "data"}
        payload_str = json.dumps(payload)
        signature = generate_signature(payload_str, 'test_secret')
        
        with patch('app.process_webhook') as mock_process, \
             patch('app.is_duplicate_delivery') as mock_duplicate:
            
            mock_duplicate.return_value = False
            mock_process.return_value = True
            
            # First request
            headers1 = {
                'X-Hub-Signature-256': signature,
                'X-GitHub-Event': 'push',
                'X-GitHub-Delivery': 'delivery-123'
            }
            
            response1 = client.post('/webhook',
                                  data=payload_str,
                                  headers=headers1,
                                  content_type='application/json')
            assert response1.status_code == 200
            
            # Second request with different delivery ID
            headers2 = {
                'X-Hub-Signature-256': signature,
                'X-GitHub-Event': 'push',
                'X-GitHub-Delivery': 'delivery-456'
            }
            
            response2 = client.post('/webhook',
                                  data=payload_str,
                                  headers=headers2,
                                  content_type='application/json')
            assert response2.status_code == 200
            assert mock_process.call_count == 2


class TestWebhookProcessing:
    
    def test_process_webhook_push(self):
        from app import process_webhook
        
        event_type = 'push'
        payload = {
            "ref": "refs/heads/main",
            "repository": {"full_name": "test/repo"},
            "commits": [{"id": "abc123", "message": "Test"}]
        }
        delivery_id = "test-delivery-123"
        
        with patch('app.store_delivery_id') as mock_store:
            result = process_webhook(event_type, payload, delivery_id)
            assert result is True
            mock_store.assert_called_once_with(delivery_id)
    
    def test_process_webhook_unsupported_event(self):
        from app import process_webhook
        
        event_type = 'unsupported_event'
        payload = {"test": "data"}
        delivery_id = "test-delivery-123"
        
        with patch('app.store_delivery_id') as mock_store:
            result = process_webhook(event_type, payload, delivery_id)
            assert result is True
            mock_store.assert_called_once_with(delivery_id)
    
    @patch('app.logger')
    def test_process_webhook_logging(self, mock_logger):
        from app import process_webhook
        
        event_type = 'push'
        payload = {"repository": {"full_name": "test/repo"}}
        delivery_id = "test-delivery-123"
        
        with patch('app.store_delivery_id'):
            process_webhook(event_type, payload, delivery_id)
            mock_logger.info.assert_called()


class TestErrorHandling:
    
    def test_webhook_malformed_json(self, client):
        signature = generate_signature('invalid json', 'test_secret')
        headers = {
            'X-Hub-Signature-256': signature,
            'X-GitHub-Event': 'push',
            'X-GitHub-Delivery': 'test-delivery-123'
        }
        
        response = client.post('/webhook',
                             data='invalid json',
                             headers=headers,
                             content_type='application/json')
        assert response.status_code == 400
    
    def test_webhook_missing_event_header(self, client):
        payload = {"test": "data"}
        payload_str = json.dumps(payload)
        signature = generate_signature(payload_str, 'test_secret')
        
        headers = {
            'X-Hub-Signature-256': signature,
            'X-GitHub-Delivery': 'test-delivery-123'
        }
        
        response = client.post('/webhook',
                             data=payload_str,
                             headers=headers,
                             content_type='application/json')
        assert response.status_code == 400
    
    def test_webhook_processing_exception(self, client):
        payload = {"test": "data"}
        payload_str = json.dumps(payload)
        signature = generate_signature(payload_str, 'test_secret')
        
        headers = {
            'X-Hub-Signature-256': signature,
            'X-GitHub-Event': 'push',
            'X-GitHub-Delivery': 'test-delivery-123'
        }
        
        with patch('app.process_webhook') as mock_process:
            mock_process.side_effect = Exception("Processing error")
            response = client.post('/webhook',
                                 data=payload_str,
                                 headers=headers,
                                 content_type='application/json')
            assert response.status_code == 500