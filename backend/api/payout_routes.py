from flask import Blueprint, request, jsonify, current_app
from functools import wraps
from typing import Dict, Any, Optional, List
import logging
from datetime import datetime, timedelta

from ..services.payout_service import PayoutService
from ..services.auth_service import AuthService
from ..models.payout import Payout, PayoutStatus
from ..utils.validation import validate_solana_address, validate_amount
from ..utils.errors import ValidationError, PayoutError, AuthError

logger = logging.getLogger(__name__)

payout_bp = Blueprint('payouts', __name__, url_prefix='/api/payouts')

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization header'}), 401

        token = auth_header[7:]
        try:
            user_data = AuthService.verify_token(token)
            if not user_data.get('is_admin', False):
                return jsonify({'error': 'Admin privileges required'}), 403
            request.current_user = user_data
        except AuthError as e:
            return jsonify({'error': str(e)}), 401

        return f(*args, **kwargs)
    return decorated_function

def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required'}), 401

        token = auth_header[7:]
        try:
            user_data = AuthService.verify_token(token)
            request.current_user = user_data
        except AuthError as e:
            return jsonify({'error': str(e)}), 401

        return f(*args, **kwargs)
    return decorated_function

@payout_bp.route('/trigger', methods=['POST'])
@admin_required
def trigger_payout():
    """Trigger a manual payout for a specific issue/PR."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'JSON body required'}), 400

        # Validate required fields
        required_fields = ['recipient_address', 'amount', 'issue_number']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        recipient_address = data['recipient_address']
        amount = data['amount']
        issue_number = data['issue_number']
        reason = data.get('reason', 'Manual payout')

        # Validate inputs
        if not validate_solana_address(recipient_address):
            return jsonify({'error': 'Invalid Solana address'}), 400

        if not validate_amount(amount):
            return jsonify({'error': 'Invalid amount'}), 400

        payout_service = PayoutService()
        payout_id = payout_service.create_payout(
            recipient_address=recipient_address,
            amount=amount,
            issue_number=issue_number,
            reason=reason,
            triggered_by=request.current_user['user_id']
        )

        return jsonify({
            'success': True,
            'payout_id': payout_id,
            'message': 'Payout created successfully'
        }), 201

    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except PayoutError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Unexpected error in trigger_payout: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@payout_bp.route('/history', methods=['GET'])
@auth_required
def get_payout_history():
    """Get payout history with optional filtering."""
    try:
        # Parse query parameters
        page = int(request.args.get('page', 1))
        limit = min(int(request.args.get('limit', 50)), 100)
        status = request.args.get('status')
        recipient = request.args.get('recipient')
        issue_number = request.args.get('issue_number')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')

        # Build filters
        filters = {}
        if status and status in [s.value for s in PayoutStatus]:
            filters['status'] = PayoutStatus(status)
        if recipient and validate_solana_address(recipient):
            filters['recipient_address'] = recipient
        if issue_number:
            try:
                filters['issue_number'] = int(issue_number)
            except ValueError:
                return jsonify({'error': 'Invalid issue number'}), 400

        # Parse date filters
        if date_from:
            try:
                filters['date_from'] = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid date_from format'}), 400

        if date_to:
            try:
                filters['date_to'] = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid date_to format'}), 400

        payout_service = PayoutService()
        result = payout_service.get_payout_history(
            page=page,
            limit=limit,
            filters=filters
        )

        return jsonify({
            'success': True,
            'data': {
                'payouts': [payout.to_dict() for payout in result['payouts']],
                'total': result['total'],
                'page': page,
                'limit': limit,
                'has_next': result['has_next']
            }
        })

    except ValueError as e:
        return jsonify({'error': f'Invalid parameter: {e}'}), 400
    except Exception as e:
        logger.error(f"Error in get_payout_history: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@payout_bp.route('/<payout_id>/status', methods=['GET'])
@auth_required
def get_payout_status(payout_id: str):
    """Get detailed status of a specific payout."""
    try:
        payout_service = PayoutService()
        payout = payout_service.get_payout_by_id(payout_id)

        if not payout:
            return jsonify({'error': 'Payout not found'}), 404

        return jsonify({
            'success': True,
            'data': payout.to_dict()
        })

    except Exception as e:
        logger.error(f"Error in get_payout_status: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@payout_bp.route('/<payout_id>/approve', methods=['POST'])
@admin_required
def approve_payout(payout_id: str):
    """Approve a pending payout for processing."""
    try:
        payout_service = PayoutService()
        success = payout_service.approve_payout(
            payout_id=payout_id,
            approved_by=request.current_user['user_id']
        )

        if not success:
            return jsonify({'error': 'Payout not found or cannot be approved'}), 404

        return jsonify({
            'success': True,
            'message': 'Payout approved successfully'
        })

    except PayoutError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error in approve_payout: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@payout_bp.route('/<payout_id>/reject', methods=['POST'])
@admin_required
def reject_payout(payout_id: str):
    """Reject a pending payout."""
    try:
        data = request.get_json() or {}
        reason = data.get('reason', 'Rejected by admin')

        payout_service = PayoutService()
        success = payout_service.reject_payout(
            payout_id=payout_id,
            rejected_by=request.current_user['user_id'],
            reason=reason
        )

        if not success:
            return jsonify({'error': 'Payout not found or cannot be rejected'}), 404

        return jsonify({
            'success': True,
            'message': 'Payout rejected successfully'
        })

    except PayoutError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error in reject_payout: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@payout_bp.route('/queue', methods=['GET'])
@admin_required
def get_payout_queue():
    """Get pending payouts awaiting approval."""
    try:
        payout_service = PayoutService()
        pending_payouts = payout_service.get_pending_payouts()

        return jsonify({
            'success': True,
            'data': {
                'pending_payouts': [payout.to_dict() for payout in pending_payouts],
                'count': len(pending_payouts)
            }
        })

    except Exception as e:
        logger.error(f"Error in get_payout_queue: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@payout_bp.route('/retry/<payout_id>', methods=['POST'])
@admin_required
def retry_payout(payout_id: str):
    """Retry a failed payout."""
    try:
        payout_service = PayoutService()
        success = payout_service.retry_failed_payout(payout_id)

        if not success:
            return jsonify({'error': 'Payout not found or cannot be retried'}), 404

        return jsonify({
            'success': True,
            'message': 'Payout retry initiated'
        })

    except PayoutError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error in retry_payout: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@payout_bp.route('/stats', methods=['GET'])
@auth_required
def get_payout_stats():
    """Get payout statistics and summary."""
    try:
        payout_service = PayoutService()
        stats = payout_service.get_payout_stats()

        return jsonify({
            'success': True,
            'data': stats
        })

    except Exception as e:
        logger.error(f"Error in get_payout_stats: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@payout_bp.route('/webhook/telegram', methods=['POST'])
def telegram_webhook():
    """Handle Telegram bot callbacks for payout approvals."""
    try:
        data = request.get_json()
        if not data or 'callback_query' not in data:
            return jsonify({'ok': True})

        callback_data = data['callback_query']['data']
        user_id = data['callback_query']['from']['id']

        # Parse callback data (format: "approve:payout_id" or "reject:payout_id")
        if ':' not in callback_data:
            return jsonify({'ok': True})

        action, payout_id = callback_data.split(':', 1)

        payout_service = PayoutService()

        if action == 'approve':
            success = payout_service.approve_payout_via_telegram(payout_id, user_id)
        elif action == 'reject':
            success = payout_service.reject_payout_via_telegram(payout_id, user_id)
        else:
            return jsonify({'ok': True})

        return jsonify({'ok': True})

    except Exception as e:
        logger.error(f"Error in telegram_webhook: {e}")
        return jsonify({'ok': True})

@payout_bp.errorhandler(404)
def handle_not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404

@payout_bp.errorhandler(405)
def handle_method_not_allowed(e):
    return jsonify({'error': 'Method not allowed'}), 405
