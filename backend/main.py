import asyncio
import uuid
import random
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

app = FastAPI(title="SolFoundry WebSocket Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Async Server for Socket.IO
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Dummy data generation for simulated real-time events
EVENT_TYPES = ['completed', 'submitted', 'posted', 'review']
USERNAMES = ['devbuilder', 'KodeSage', 'SolanaLabs', '0xHunter', 'RustWiz', 'CryptoKnight']

async def generate_mock_events():
    """Background task that emits random events to all connected clients."""
    while True:
        await asyncio.sleep(random.uniform(5, 15))  # Emit an event every 5 to 15 seconds
        
        event_type = random.choice(EVENT_TYPES)
        username = random.choice(USERNAMES)
        detail = ""
        
        if event_type == 'completed':
            detail = f"${random.randint(100, 2000)} USDC from Bounty #{random.randint(1, 200)}"
        elif event_type == 'submitted':
            detail = f"PR to Bounty #{random.randint(1, 200)}"
        elif event_type == 'posted':
            detail = f"Bounty #{random.randint(1, 200)} — ${random.randint(500, 5000)} USDC"
        elif event_type == 'review':
            detail = f"Bounty #{random.randint(1, 200)} — {random.choice(['8.5/10', '9/10', '10/10'])}"
            
        event_payload = {
            "id": str(uuid.uuid4()),
            "type": event_type,
            "username": username,
            "avatar_url": None,
            "detail": detail,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Broadcast to all connected clients
        await sio.emit('activity_feed', event_payload)


@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@app.on_event("startup")
async def startup_event():
    # Start the background task to generate mock events
    asyncio.create_task(generate_mock_events())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:socket_app", host="0.0.0.0", port=8000, reload=True)
