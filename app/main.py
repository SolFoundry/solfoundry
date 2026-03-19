import json
import logging
from typing import Dict, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import redis
import asyncio
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Real-time WebSocket Server", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis connection
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(redis_url, decode_responses=True)

# Connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, room: str = "default"):
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = set()
        self.active_connections[room].add(websocket)
        logger.info(f"Client connected to room: {room}")
    
    def disconnect(self, websocket: WebSocket, room: str = "default"):
        if room in self.active_connections:
            self.active_connections[room].discard(websocket)
            if not self.active_connections[room]:
                del self.active_connections[room]
        logger.info(f"Client disconnected from room: {room}")
    
    async def broadcast_to_room(self, message: dict, room: str = "default"):
        if room in self.active_connections:
            message_str = json.dumps(message)
            disconnected = set()
            
            for connection in self.active_connections[room]:
                try:
                    await connection.send_text(message_str)
                except:
                    disconnected.add(connection)
            
            # Remove disconnected clients
            for connection in disconnected:
                self.active_connections[room].discard(connection)

manager = ConnectionManager()

@app.get("/")
async def root():
    return {"message": "Real-time WebSocket Server is running"}

@app.get("/health")
async def health_check():
    try:
        redis_client.ping()
        return {"status": "healthy", "redis": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "redis": "disconnected", "error": str(e)}

@app.websocket("/ws/{room}")
async def websocket_endpoint(websocket: WebSocket, room: str):
    await manager.connect(websocket, room)
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                
                # Store message in Redis
                redis_key = f"room:{room}:messages"
                redis_client.lpush(redis_key, json.dumps({
                    "message": message,
                    "timestamp": asyncio.get_event_loop().time()
                }))
                redis_client.ltrim(redis_key, 0, 99)  # Keep last 100 messages
                
                # Broadcast to all clients in room
                await manager.broadcast_to_room({
                    "type": "message",
                    "room": room,
                    "data": message,
                    "timestamp": asyncio.get_event_loop().time()
                }, room)
                
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)

@app.get("/rooms/{room}/history")
async def get_room_history(room: str, limit: int = 10):
    try:
        redis_key = f"room:{room}:messages"
        messages = redis_client.lrange(redis_key, 0, limit - 1)
        return {
            "room": room,
            "messages": [json.loads(msg) for msg in messages]
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/rooms")
async def get_active_rooms():
    return {
        "active_rooms": list(manager.active_connections.keys()),
        "connection_counts": {
            room: len(connections) 
            for room, connections in manager.active_connections.items()
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)