"""Tests for rate limiting and security middleware."""
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from src.middleware.rate_limit import RateLimitAndSecurityMiddleware

app = FastAPI()
app.add_middleware(
    RateLimitAndSecurityMiddleware,
    blocked_ips=["192.168.1.100"],
    max_payload_size=100,  # Small size for test
    endpoints_config={"/api": {"limit": 2, "window": 60}}
)

@app.get("/api/test")
async def read_test():
    return {"status": "ok"}

@app.post("/api/data")
async def post_data(request: Request):
    return {"status": "created"}

client = TestClient(app)

def test_security_headers():
    response = client.get("/api/test")
    assert response.status_code == 200
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Strict-Transport-Security") is not None
    assert response.headers.get("Content-Security-Policy") is not None

def test_rate_limiting():
    # Setup test app specifically to verify rate limiting bounds
    test_app = FastAPI()
    test_app.add_middleware(
        RateLimitAndSecurityMiddleware,
        endpoints_config={"/api": {"limit": 2, "window": 60}}
    )
    @test_app.get("/api/test")
    async def endpoint():
        return {"status": "ok"}
    
    test_client = TestClient(test_app)
    
    # 1st request should pass
    r1 = test_client.get("/api/test")
    assert r1.status_code == 200
    
    # 2nd request should pass
    r2 = test_client.get("/api/test")
    assert r2.status_code == 200
    
    # 3rd request should fail
    r3 = test_client.get("/api/test")
    assert r3.status_code == 429
    assert r3.json()["detail"] == "Rate limit exceeded."
    assert "Retry-After" in r3.headers

def test_blocked_ip():
    # Mocking client IP in TestClient requires a workaround or direct testing
    test_app = FastAPI()
    test_app.add_middleware(
        RateLimitAndSecurityMiddleware,
        blocked_ips=["testclient"]
    )
    @test_app.get("/api/test")
    async def endpoint():
        return {"status": "ok"}
        
    test_client = TestClient(test_app)
    # TestClient sets host to 'testclient'
    response = test_client.get("/api/test")
    assert response.status_code == 403
    assert response.json()["detail"] == "IP address is blocked."

def test_payload_size_limit():
    large_payload = "x" * 150
    response = client.post("/api/data", data=large_payload)
    assert response.status_code == 413
    assert response.json()["detail"] == "Payload too large."
