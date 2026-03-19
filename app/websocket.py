import asyncio
import json
import logging
from typing import Dict, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect, HTTPException
from jose import JWTError, jwt
import redis.asyncio as redis
from app.core.config import settings
from app.core.security import SECRET_KEY, ALGORITHM

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_connections: Dict[int, Set[str]] = {}
        self.channel_subscriptions: Dict[str, Set[str]] = {}
        self.connection_channels: Dict[str, Set[str]] = {}
        self.redis_client: Optional[redis.Redis] = None
        self.pubsub = None

    async def initialize_redis(self):
        """Initialize Redis connection for pub/sub"""
        try:
            self.redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                db=0,
                decode_responses=True
            )
            self.pubsub = self.redis_client.pubsub()
            await self.redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise

    async def authenticate_websocket(self, websocket: WebSocket, token: str) -> Optional[Dict]:
        """Authenticate WebSocket connection using JWT token"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: int = payload.get("sub")
            if user_id is None:
                return None
            return {"user_id": user_id, "username": payload.get("username")}
        except JWTError:
            return None

    async def connect(self, websocket: WebSocket, connection_id: str, user_data: Dict):
        """Accept WebSocket connection and register it"""
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        
        user_id = user_data["user_id"]
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(connection_id)
        
        self.connection_channels[connection_id] = set()
        
        logger.info(f"WebSocket connection established: {connection_id} for user {user_id}")

    async def disconnect(self, connection_id: str):
        """Remove WebSocket connection and clean up subscriptions"""
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            
            # Remove from user connections
            for user_id, connections in self.user_connections.items():
                if connection_id in connections:
                    connections.discard(connection_id)
                    if not connections:
                        del self.user_connections[user_id]
                    break
            
            # Remove from channel subscriptions
            channels_to_remove = self.connection_channels.get(connection_id, set()).copy()
            for channel in channels_to_remove:
                await self.unsubscribe_from_channel(connection_id, channel)
            
            # Clean up connection data
            del self.active_connections[connection_id]
            if connection_id in self.connection_channels:
                del self.connection_channels[connection_id]
            
            logger.info(f"WebSocket connection removed: {connection_id}")

    async def subscribe_to_channel(self, connection_id: str, channel: str):
        """Subscribe connection to a channel"""
        if channel not in self.channel_subscriptions:
            self.channel_subscriptions[channel] = set()
            # Subscribe to Redis channel
            if self.pubsub:
                await self.pubsub.subscribe(channel)
        
        self.channel_subscriptions[channel].add(connection_id)
        self.connection_channels[connection_id].add(channel)
        
        logger.info(f"Connection {connection_id} subscribed to channel {channel}")

    async def unsubscribe_from_channel(self, connection_id: str, channel: str):
        """Unsubscribe connection from a channel"""
        if channel in self.channel_subscriptions:
            self.channel_subscriptions[channel].discard(connection_id)
            
            # If no more connections, unsubscribe from Redis
            if not self.channel_subscriptions[channel]:
                del self.channel_subscriptions[channel]
                if self.pubsub:
                    await self.pubsub.unsubscribe(channel)
        
        if connection_id in self.connection_channels:
            self.connection_channels[connection_id].discard(channel)
        
        logger.info(f"Connection {connection_id} unsubscribed from channel {channel}")

    async def send_personal_message(self, message: str, connection_id: str):
        """Send message to specific connection"""
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            try:
                await websocket.send_text(message)
            except Exception as e:
                logger.error(f"Error sending message to {connection_id}: {e}")
                await self.disconnect(connection_id)

    async def send_to_user(self, message: str, user_id: int):
        """Send message to all connections of a specific user"""
        if user_id in self.user_connections:
            connections = self.user_connections[user_id].copy()
            for connection_id in connections:
                await self.send_personal_message(message, connection_id)

    async def broadcast_to_channel(self, message: str, channel: str):
        """Send message to all connections subscribed to a channel"""
        if channel in self.channel_subscriptions:
            connections = self.channel_subscriptions[channel].copy()
            for connection_id in connections:
                await self.send_personal_message(message, connection_id)

    async def publish_to_redis(self, channel: str, message: Dict):
        """Publish message to Redis channel"""
        if self.redis_client:
            try:
                await self.redis_client.publish(channel, json.dumps(message))
                logger.debug(f"Message published to Redis channel {channel}")
            except Exception as e:
                logger.error(f"Error publishing to Redis channel {channel}: {e}")

    async def listen_redis_messages(self):
        """Listen for Redis pub/sub messages and broadcast to WebSocket connections"""
        if not self.pubsub:
            return
            
        try:
            async for message in self.pubsub.listen():
                if message['type'] == 'message':
                    channel = message['channel']
                    data = message['data']
                    await self.broadcast_to_channel(data, channel)
        except Exception as e:
            logger.error(f"Error in Redis message listener: {e}")

    async def handle_message(self, websocket: WebSocket, connection_id: str, message: Dict):
        """Handle incoming WebSocket message"""
        try:
            message_type = message.get("type")
            
            if message_type == "subscribe":
                channel = message.get("channel")
                if channel:
                    await self.subscribe_to_channel(connection_id, channel)
                    await websocket.send_text(json.dumps({
                        "type": "subscribed",
                        "channel": channel,
                        "status": "success"
                    }))
            
            elif message_type == "unsubscribe":
                channel = message.get("channel")
                if channel:
                    await self.unsubscribe_from_channel(connection_id, channel)
                    await websocket.send_text(json.dumps({
                        "type": "unsubscribed",
                        "channel": channel,
                        "status": "success"
                    }))
            
            elif message_type == "message":
                channel = message.get("channel")
                content = message.get("content")
                if channel and content:
                    # Broadcast to local connections and Redis
                    broadcast_message = {
                        "type": "message",
                        "channel": channel,
                        "content": content,
                        "connection_id": connection_id
                    }
                    await self.broadcast_to_channel(json.dumps(broadcast_message), channel)
                    await self.publish_to_redis(channel, broadcast_message)
            
            elif message_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                
        except Exception as e:
            logger.error(f"Error handling message from {connection_id}: {e}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Invalid message format"
            }))

    def get_connection_count(self) -> int:
        """Get total number of active connections"""
        return len(self.active_connections)

    def get_channel_connections(self, channel: str) -> int:
        """Get number of connections subscribed to a channel"""
        return len(self.channel_subscriptions.get(channel, set()))

# Global connection manager instance
manager = ConnectionManager()

async def websocket_endpoint(websocket: WebSocket, token: str = None):
    """Main WebSocket endpoint handler"""
    connection_id = f"ws_{id(websocket)}_{asyncio.get_event_loop().time()}"
    
    try:
        # Authenticate connection
        if not token:
            await websocket.close(code=4001, reason="Authentication token required")
            return
        
        user_data = await manager.authenticate_websocket(websocket, token)
        if not user_data:
            await websocket.close(code=4001, reason="Invalid authentication token")
            return
        
        # Initialize Redis if not already done
        if not manager.redis_client:
            await manager.initialize_redis()
            # Start Redis listener task
            asyncio.create_task(manager.listen_redis_messages())
        
        # Connect user
        await manager.connect(websocket, connection_id, user_data)
        
        # Send welcome message
        welcome_message = {
            "type": "connected",
            "connection_id": connection_id,
            "user_id": user_data["user_id"],
            "message": "WebSocket connection established"
        }
        await websocket.send_text(json.dumps(welcome_message))
        
        # Handle incoming messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                await manager.handle_message(websocket, connection_id, message)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
            except WebSocketDisconnect:
                break
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {connection_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {connection_id}: {e}")
    finally:
        await manager.disconnect(connection_id)