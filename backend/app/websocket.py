"""WebSocket manager for real-time notifications."""
from typing import Dict, Set
from fastapi import WebSocket
import json


class ConnectionManager:
    """Manage WebSocket connections."""
    
    def __init__(self):
        # user_id -> set of websockets
        self.active_connections: Dict[int, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int):
        """Accept connection and register user."""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        
        self.active_connections[user_id].add(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: int):
        """Disconnect and unregister user."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
    
    async def send_personal_message(self, message: dict, user_id: int):
        """Send message to specific user."""
        if user_id in self.active_connections:
            message_str = json.dumps(message)
            
            # Send to all connections for this user
            disconnected = set()
            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_text(message_str)
                except Exception:
                    disconnected.add(websocket)
            
            # Clean up disconnected websockets
            for ws in disconnected:
                self.disconnect(ws, user_id)
    
    async def broadcast(self, message: dict):
        """Broadcast message to all users."""
        message_str = json.dumps(message)
        
        disconnected_users = []
        
        for user_id, connections in self.active_connections.items():
            for websocket in connections:
                try:
                    await websocket.send_text(message_str)
                except Exception:
                    disconnected_users.append((user_id, websocket))
        
        # Clean up disconnected websockets
        for user_id, ws in disconnected_users:
            self.disconnect(ws, user_id)


manager = ConnectionManager()
