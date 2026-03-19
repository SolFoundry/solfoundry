from fastapi.testclient import TestClient
from fastapi import FastAPI
from app.api.contributors import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)

def test_get_dashboard():
    response = client.get("/contributors/123/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["contributor_id"] == "123"
    assert data["username"] == "User_123"
    assert "stats" in data
    assert "recent_activity" in data
