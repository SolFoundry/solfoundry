from flask import Blueprint, request, jsonify, current_app
import hmac
import hashlib
import json
from functools import wraps
from app.models import Repository, Bounty, db
from app.services.github_service import GitHubService
from app.services.sync_service import SyncService

webhooks_bp = Blueprint('webhooks', __name__)

def verify_github_signature(f):
    """Decorator to verify GitHub webhook signature"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        signature = request.headers.get('X-Hub-Signature-256')
        if not signature:
            return jsonify({'error': 'Missing signature'}), 401
        
        webhook_secret = current_app.config.get('GITHUB_WEBHOOK_SECRET')
        if not webhook_secret:
            current_app.logger.error('GitHub webhook secret not configured')
            return jsonify({'error': 'Webhook not configured'}), 500
        
        payload = request.get_data()
        expected_signature = 'sha256=' + hmac.new(
            webhook_secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            return jsonify({'error': 'Invalid signature'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

@webhooks_bp.route('/github', methods=['POST'])
@verify_github_signature
def github_webhook():
    """Handle GitHub webhook events"""
    try:
        event_type = request.headers.get('X-GitHub-Event')
        payload = request.get_json()
        
        if not event_type or not payload:
            return jsonify({'error': 'Invalid webhook payload'}), 400
        
        # Log the event
        current_app.logger.info(f'Received GitHub webhook: {event_type}')
        
        # Route to appropriate handler
        if event_type == 'issues':
            return handle_issues_event(payload)
        elif event_type == 'issue_comment':
            return handle_issue_comment_event(payload)
        elif event_type == 'repository':
            return handle_repository_event(payload)
        elif event_type == 'push':
            return handle_push_event(payload)
        elif event_type == 'pull_request':
            return handle_pull_request_event(payload)
        elif event_type == 'ping':
            return handle_ping_event(payload)
        else:
            current_app.logger.info(f'Unhandled event type: {event_type}')
            return jsonify({'message': f'Event {event_type} received but not handled'}), 200
            
    except Exception as e:
        current_app.logger.error(f'Error processing webhook: {str(e)}')
        return jsonify({'error': 'Internal server error'}), 500

def handle_issues_event(payload):
    """Handle GitHub issues events"""
    action = payload.get('action')
    issue = payload.get('issue', {})
    repository = payload.get('repository', {})
    
    repo_full_name = repository.get('full_name')
    if not repo_full_name:
        return jsonify({'error': 'Missing repository information'}), 400
    
    # Find the repository in our database
    repo = Repository.query.filter_by(full_name=repo_full_name).first()
    if not repo:
        current_app.logger.info(f'Repository {repo_full_name} not found in database')
        return jsonify({'message': 'Repository not tracked'}), 200
    
    # Check if this is a bounty-related issue
    issue_labels = [label.get('name', '') for label in issue.get('labels', [])]
    is_bounty = any('bounty' in label.lower() for label in issue_labels)
    
    if not is_bounty:
        return jsonify({'message': 'Issue not bounty-related'}), 200
    
    # Sync the issue
    sync_service = SyncService()
    
    if action in ['opened', 'reopened']:
        sync_service.sync_issue_to_bounty(repo.id, issue)
    elif action == 'closed':
        sync_service.close_bounty_from_issue(repo.id, issue)
    elif action in ['edited', 'labeled', 'unlabeled']:
        sync_service.update_bounty_from_issue(repo.id, issue)
    
    return jsonify({'message': f'Issue {action} event processed'}), 200

def handle_issue_comment_event(payload):
    """Handle GitHub issue comment events"""
    action = payload.get('action')
    comment = payload.get('comment', {})
    issue = payload.get('issue', {})
    repository = payload.get('repository', {})
    
    if action not in ['created', 'edited', 'deleted']:
        return jsonify({'message': 'Comment action not handled'}), 200
    
    repo_full_name = repository.get('full_name')
    repo = Repository.query.filter_by(full_name=repo_full_name).first()
    
    if not repo:
        return jsonify({'message': 'Repository not tracked'}), 200
    
    # Find associated bounty
    bounty = Bounty.query.filter_by(
        repository_id=repo.id,
        github_issue_number=issue.get('number')
    ).first()
    
    if not bounty:
        return jsonify({'message': 'No bounty associated with issue'}), 200
    
    # Sync comment
    sync_service = SyncService()
    sync_service.sync_comment_to_bounty(bounty.id, comment, action)
    
    return jsonify({'message': f'Comment {action} event processed'}), 200

def handle_repository_event(payload):
    """Handle GitHub repository events"""
    action = payload.get('action')
    repository = payload.get('repository', {})
    
    repo_full_name = repository.get('full_name')
    
    if action == 'deleted':
        # Remove repository from tracking
        repo = Repository.query.filter_by(full_name=repo_full_name).first()
        if repo:
            # Archive associated bounties
            bounties = Bounty.query.filter_by(repository_id=repo.id).all()
            for bounty in bounties:
                bounty.status = 'archived'
            
            db.session.delete(repo)
            db.session.commit()
            
        return jsonify({'message': 'Repository removed from tracking'}), 200
    
    elif action in ['privatized', 'publicized']:
        # Update repository visibility
        repo = Repository.query.filter_by(full_name=repo_full_name).first()
        if repo:
            repo.is_private = repository.get('private', False)
            db.session.commit()
            
        return jsonify({'message': 'Repository visibility updated'}), 200
    
    return jsonify({'message': f'Repository {action} event processed'}), 200

def handle_push_event(payload):
    """Handle GitHub push events"""
    repository = payload.get('repository', {})
    commits = payload.get('commits', [])
    ref = payload.get('ref', '')
    
    # Only handle pushes to main/master branch
    if ref not in ['refs/heads/main', 'refs/heads/master']:
        return jsonify({'message': 'Push to non-main branch ignored'}), 200
    
    repo_full_name = repository.get('full_name')
    repo = Repository.query.filter_by(full_name=repo_full_name).first()
    
    if not repo:
        return jsonify({'message': 'Repository not tracked'}), 200
    
    # Check commits for bounty-related references
    sync_service = SyncService()
    
    for commit in commits:
        message = commit.get('message', '')
        # Look for patterns like "fixes #123" or "closes #456"
        import re
        issue_refs = re.findall(r'(?:fixes|closes|resolves)\s+#(\d+)', message, re.IGNORECASE)
        
        for issue_number in issue_refs:
            bounty = Bounty.query.filter_by(
                repository_id=repo.id,
                github_issue_number=int(issue_number)
            ).first()
            
            if bounty:
                sync_service.handle_commit_reference(bounty.id, commit)
    
    return jsonify({'message': 'Push event processed'}), 200

def handle_pull_request_event(payload):
    """Handle GitHub pull request events"""
    action = payload.get('action')
    pull_request = payload.get('pull_request', {})
    repository = payload.get('repository', {})
    
    if action not in ['opened', 'closed', 'merged']:
        return jsonify({'message': 'PR action not handled'}), 200
    
    repo_full_name = repository.get('full_name')
    repo = Repository.query.filter_by(full_name=repo_full_name).first()
    
    if not repo:
        return jsonify({'message': 'Repository not tracked'}), 200
    
    # Check if PR references any bounty issues
    pr_body = pull_request.get('body', '')
    import re
    issue_refs = re.findall(r'(?:fixes|closes|resolves)\s+#(\d+)', pr_body, re.IGNORECASE)
    
    sync_service = SyncService()
    
    for issue_number in issue_refs:
        bounty = Bounty.query.filter_by(
            repository_id=repo.id,
            github_issue_number=int(issue_number)
        ).first()
        
        if bounty:
            sync_service.handle_pull_request_event(bounty.id, pull_request, action)
    
    return jsonify({'message': 'Pull request event processed'}), 200

def handle_ping_event(payload):
    """Handle GitHub ping events"""
    return jsonify({'message': 'pong'}), 200

@webhooks_bp.route('/sync/repository/<int:repo_id>', methods=['POST'])
def trigger_repository_sync(repo_id):
    """Manually trigger a full repository sync"""
    try:
        repo = Repository.query.get_or_404(repo_id)
        
        # Verify user has permission to sync this repository
        # This would typically check authentication/authorization
        
        sync_service = SyncService()
        result = sync_service.full_repository_sync(repo.id)
        
        return jsonify({
            'message': 'Repository sync triggered',
            'result': result
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error triggering repository sync: {str(e)}')
        return jsonify({'error': 'Sync failed'}), 500

@webhooks_bp.route('/sync/bounty/<int:bounty_id>', methods=['POST'])
def trigger_bounty_sync(bounty_id):
    """Manually trigger a bounty sync"""
    try:
        bounty = Bounty.query.get_or_404(bounty_id)
        
        sync_service = SyncService()
        result = sync_service.sync_bounty_to_github(bounty.id)
        
        return jsonify({
            'message': 'Bounty sync triggered',
            'result': result
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error triggering bounty sync: {str(e)}')
        return jsonify({'error': 'Bounty sync failed'}), 500

@webhooks_bp.route('/health', methods=['GET'])
def webhook_health():
    """Health check endpoint for webhook service"""
    return jsonify({
        'status': 'healthy',
        'service': 'webhooks',
        'timestamp': json.loads(json.dumps(None))
    }), 200