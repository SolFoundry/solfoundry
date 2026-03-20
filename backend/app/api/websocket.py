"""WebSocket API endpoints for real-time updates.

This module provides WebSocket endpoints for real-time event streaming:
- PR status changes
- New comments
- Review completions
- Payout notifications

Endpoints:
    WS /ws/{user_id} - Main WebSocket connection endpoint

Message Format:
    Incoming:
        {"type": "subscribe", "scope": "repo", "target_id": "repo_123"}
        {"type": "unsubscribe", "scope": "repo", "target_id": "repo_123"}
        {"type": "pong", "ping_id": "ping_123456"}
    
    Outgoing:
        {"event": "pr_status_changed", "timestamp": "...", "data": {...}}
        {"event": "heartbeat", "timestamp": "...", "ping_id": "ping_123456"}
        {"event": "error", "error_code": "...", "error_message": "..."}
"""

import logging
import json
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from pydantic import BaseModel, Field, ValidationError

from app.services.websocket_manager import (
    manager,
    EventType,
    SubscriptionScope,
    Subscription,
    WebSocketMessage,
    ErrorMessage,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


# Incoming message schemas
class SubscribeMessage(BaseModel):
    """Client subscription request."""
    type: str = "subscribe"
    scope: str
    target_id: str


class UnsubscribeMessage(BaseModel):
    """Client unsubscription request."""
    type: str = "unsubscribe"
    scope: str
    target_id: str


class PongMessage(BaseModel):
    """Client pong response to heartbeat."""
    type: str = "pong"
    ping_id: str


class PingMessage(BaseModel):
    """Client-initiated ping for connection testing."""
    type: str = "ping"


class ClientMessage(BaseModel):
    """Base class for client messages."""
    type: str
    
    class Config:
        extra = "allow"  # Allow additional fields for different message types


async def parse_client_message(data: str) -> Optional[BaseModel]:
    """Parse incoming WebSocket message."""
    try:
        raw = json.loads(data)
        msg_type = raw.get("type", "").lower()
        
        if msg_type == "subscribe":
            return SubscribeMessage(**raw)
        elif msg_type == "unsubscribe":
            return UnsubscribeMessage(**raw)
        elif msg_type == "pong":
            return PongMessage(**raw)
        elif msg_type == "ping":
            return PingMessage(**raw)
        else:
            logger.warning(f"Unknown message type: {msg_type}")
            return None
            
    except json.JSONDecodeError:
        logger.warning("Invalid JSON received")
        return None
    except ValidationError as e:
        logger.warning(f"Validation error: {e}")
        return None


async def send_error(
    websocket: WebSocket, 
    error_code: str, 
    error_message: str,
    details: Optional[dict] = None
) -> None:
    """Send an error message to the client."""
    error = ErrorMessage(
        error_code=error_code,
        error_message=error_message,
        details=details
    )
    await websocket.send_json(error.model_dump(mode="json"))


# Rate limiting error codes
RATE_LIMIT_ERROR = "RATE_LIMIT_EXCEEDED"
CONNECTION_LIMIT_ERROR = "CONNECTION_LIMIT_EXCEEDED"


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    token: Optional[str] = Query(None),
    reconnect: bool = Query(False)
):
    """
    Main WebSocket endpoint for real-time updates.
    
    Args:
        user_id: The authenticated user's ID
        token: Optional authentication token (for future auth integration)
        reconnect: Whether this is a reconnection attempt
    
    Connection Flow:
        1. Client connects with user_id (and optionally token)
        2. Server accepts connection and sends confirmation
        3. Client subscribes to channels (user, repo, bounty)
        4. Server sends events matching subscriptions
        5. Server sends periodic heartbeats
        6. Client responds with pong
        7. On disconnect, client can reconnect with reconnect=true
    
    Example:
        ws = WebSocket("ws://localhost:8000/ws/user_123?token=abc")
        ws.send('{"type": "subscribe", "scope": "repo", "target_id": "repo_456"}')
    """
    # TODO: Add proper authentication when auth system is ready
    # For now, we accept any user_id
    # if not validate_token(token, user_id):
    #     await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    #     return
    
    # Connect to the manager (with connection limit check)
    try:
        info = await manager.connect(websocket, user_id)
    except ConnectionRefusedError as e:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=str(e))
        return
    
    # Send connection confirmation
    await websocket.send_json({
        "event": "connected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": {
            "user_id": user_id,
            "message": "Connected to SolFoundry real-time updates",
            "reconnected": reconnect
        }
    })
    
    # Auto-subscribe to user's personal channel
    user_subscription = Subscription(
        scope=SubscriptionScope.USER,
        target_id=user_id
    )
    await manager.subscribe(websocket, user_subscription)
    
    logger.info(f"WebSocket client connected: user={user_id}, reconnect={reconnect}")
    
    try:
        while True:
            # Receive and process messages from client
            data = await websocket.receive_text()
            
            # Check rate limit
            if not manager.check_rate_limit(user_id):
                await send_error(
                    websocket,
                    error_code=RATE_LIMIT_ERROR,
                    error_message="Rate limit exceeded. Please slow down.",
                    details={"max_per_minute": manager.MAX_MESSAGES_PER_MINUTE}
                )
                continue
            
            message = await parse_client_message(data)
            
            if message is None:
                await send_error(
                    websocket,
                    error_code="INVALID_MESSAGE",
                    error_message="Could not parse message"
                )
                continue
            
            if isinstance(message, SubscribeMessage):
                # Parse and validate scope
                try:
                    scope = SubscriptionScope(message.scope)
                except ValueError:
                    await send_error(
                        websocket,
                        error_code="INVALID_SCOPE",
                        error_message=f"Invalid scope: {message.scope}",
                        details={"valid_scopes": [s.value for s in SubscriptionScope]}
                    )
                    continue
                
                # Create subscription
                subscription = Subscription(
                    scope=scope,
                    target_id=message.target_id
                )
                
                # Subscribe
                success = await manager.subscribe(websocket, subscription)
                if success:
                    await websocket.send_json({
                        "event": "subscribed",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "data": {
                            "scope": scope.value,
                            "target_id": message.target_id
                        }
                    })
                    logger.debug(f"User {user_id} subscribed to {scope.value}:{message.target_id}")
                else:
                    await send_error(
                        websocket,
                        error_code="SUBSCRIPTION_FAILED",
                        error_message="Failed to subscribe"
                    )
            
            elif isinstance(message, UnsubscribeMessage):
                try:
                    scope = SubscriptionScope(message.scope)
                except ValueError:
                    await send_error(
                        websocket,
                        error_code="INVALID_SCOPE",
                        error_message=f"Invalid scope: {message.scope}"
                    )
                    continue
                
                subscription = Subscription(
                    scope=scope,
                    target_id=message.target_id
                )
                
                success = await manager.unsubscribe(websocket, subscription)
                if success:
                    await websocket.send_json({
                        "event": "unsubscribed",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "data": {
                            "scope": scope.value,
                            "target_id": message.target_id
                        }
                    })
            
            elif isinstance(message, PongMessage):
                # Update last pong time
                manager.handle_pong(websocket)
                logger.debug(f"Received pong from user {user_id}")
            
            elif isinstance(message, PingMessage):
                # Respond to client ping
                await websocket.send_json({
                    "event": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": {}
                })
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: user={user_id}")
    except Exception as e:
        logger.error(f"WebSocket error: user={user_id}, error={e}")
    finally:
        await manager.disconnect(websocket)


# HTTP endpoint for connection stats (useful for monitoring)
@router.get("/ws/stats")
async def get_websocket_stats():
    """
    Get WebSocket connection statistics.
    
    Returns:
        - total_connections: Total active WebSocket connections
        - unique_users: Number of unique users connected
        - redis_enabled: Whether Redis pub/sub is enabled
        - subscriptions: Total number of active subscriptions
    """
    return manager.get_stats()


# Helper functions for other modules to broadcast events
async def broadcast_pr_status(
    repo_id: str,
    pr_id: str,
    status: str,
    user_id: Optional[str] = None,
    extra_data: Optional[dict] = None
) -> int:
    """
    Broadcast a PR status change event.
    
    Args:
        repo_id: Repository ID
        pr_id: Pull request ID
        status: New status (pending, approved, merged, rejected)
        user_id: Optional user ID for direct notification
        extra_data: Additional event data
        
    Returns:
        Number of clients notified
    """
    data = {
        "pr_id": pr_id,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **(extra_data or {})
    }
    
    count = 0
    
    # Broadcast to repo subscribers
    count += await manager.broadcast_event(
        event_type=EventType.PR_STATUS_CHANGED,
        data=data,
        scope=SubscriptionScope.REPO,
        target_id=repo_id
    )
    
    # Also send to specific user if provided
    if user_id:
        count += await manager.broadcast_to_user(
            user_id=user_id,
            event_type=EventType.PR_STATUS_CHANGED,
            data=data
        )
    
    return count


async def broadcast_new_comment(
    repo_id: str,
    comment_id: str,
    author_id: str,
    content_preview: str,
    user_id: Optional[str] = None,
    extra_data: Optional[dict] = None
) -> int:
    """
    Broadcast a new comment event.
    
    Args:
        repo_id: Repository ID
        comment_id: Comment ID
        author_id: Comment author ID
        content_preview: First 100 chars of comment
        user_id: Optional user ID for direct notification
        extra_data: Additional event data
        
    Returns:
        Number of clients notified
    """
    data = {
        "comment_id": comment_id,
        "author_id": author_id,
        "content_preview": content_preview[:100],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **(extra_data or {})
    }
    
    count = 0
    
    count += await manager.broadcast_event(
        event_type=EventType.NEW_COMMENT,
        data=data,
        scope=SubscriptionScope.REPO,
        target_id=repo_id
    )
    
    if user_id:
        count += await manager.broadcast_to_user(
            user_id=user_id,
            event_type=EventType.NEW_COMMENT,
            data=data
        )
    
    return count


async def broadcast_review_complete(
    repo_id: str,
    pr_id: str,
    reviewer_id: str,
    result: str,
    user_id: Optional[str] = None,
    extra_data: Optional[dict] = None
) -> int:
    """
    Broadcast a review completion event.
    
    Args:
        repo_id: Repository ID
        pr_id: Pull request ID
        reviewer_id: Reviewer user ID
        result: Review result (approved, changes_requested, commented)
        user_id: Optional user ID for direct notification
        extra_data: Additional event data
        
    Returns:
        Number of clients notified
    """
    data = {
        "pr_id": pr_id,
        "reviewer_id": reviewer_id,
        "result": result,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **(extra_data or {})
    }
    
    count = 0
    
    count += await manager.broadcast_event(
        event_type=EventType.REVIEW_COMPLETE,
        data=data,
        scope=SubscriptionScope.REPO,
        target_id=repo_id
    )
    
    if user_id:
        count += await manager.broadcast_to_user(
            user_id=user_id,
            event_type=EventType.REVIEW_COMPLETE,
            data=data
        )
    
    return count


async def broadcast_payout_sent(
    bounty_id: str,
    user_id: str,
    amount: float,
    transaction_id: str,
    extra_data: Optional[dict] = None
) -> int:
    """
    Broadcast a payout notification.
    
    Args:
        bounty_id: Bounty ID
        user_id: Recipient user ID
        amount: Payment amount in SOL
        transaction_id: Solana transaction ID
        extra_data: Additional event data
        
    Returns:
        Number of clients notified
    """
    data = {
        "bounty_id": bounty_id,
        "amount": amount,
        "transaction_id": transaction_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **(extra_data or {})
    }
    
    # Broadcast to bounty subscribers
    count = await manager.broadcast_event(
        event_type=EventType.PAYOUT_SENT,
        data=data,
        scope=SubscriptionScope.BOUNTY,
        target_id=bounty_id
    )
    
    # Also send directly to user
    count += await manager.broadcast_to_user(
        user_id=user_id,
        event_type=EventType.PAYOUT_SENT,
        data=data
    )
    
    return count