"""Health check endpoints with service dependency status.

This module provides enhanced health check functionality including:
- Basic health check (/health)
- Detailed health check with dependencies (/health/detailed)
- Readiness check for Kubernetes (/health/ready)
- Liveness check for Kubernetes (/health/live)

Each check verifies:
- Database connectivity
- Redis connectivity (if configured)
- External API availability (if configured)
"""

import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from enum import Enum

from fastapi import APIRouter, Response
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.database import async_session_factory
from app.core.logging_config import get_logger


logger = get_logger(__name__)


class HealthStatus(str, Enum):
    """Health check status values."""

    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"


class DependencyStatus(BaseModel):
    """Status of a single dependency."""

    name: str = Field(..., description="Dependency name")
    status: HealthStatus = Field(..., description="Current status")
    latency_ms: Optional[float] = Field(
        None, description="Response latency in milliseconds"
    )
    error: Optional[str] = Field(None, description="Error message if unhealthy")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional details")


class HealthCheckResponse(BaseModel):
    """Response model for health check endpoints."""

    status: HealthStatus = Field(..., description="Overall health status")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When the check was performed",
    )
    version: str = Field(default="0.1.0", description="Application version")
    dependencies: Optional[List[DependencyStatus]] = Field(
        None, description="Status of individual dependencies"
    )
    uptime_seconds: Optional[float] = Field(
        None, description="Application uptime in seconds"
    )


# Application start time for uptime calculation
# Initialize to None; will be set during startup
_app_start_time: Optional[datetime] = None


def set_app_start_time() -> None:
    """Set the application start time during startup.
    
    This should be called from the FastAPI startup event.
    """
    global _app_start_time
    _app_start_time = datetime.now(timezone.utc)


def get_uptime_seconds() -> float:
    """Get the application uptime in seconds.
    
    Returns 0 if the app hasn't started yet.
    """
    if _app_start_time is None:
        return 0.0
    return (datetime.now(timezone.utc) - _app_start_time).total_seconds()


async def check_database() -> DependencyStatus:
    """Check database connectivity.

    Attempts a simple query to verify database connection is working.
    """
    import time

    start_time = time.time()

    try:
        async with async_session_factory() as session:
            # Simple query to verify connection
            result = await session.execute(text("SELECT 1"))
            result.fetchone()

        latency = (time.time() - start_time) * 1000

        return DependencyStatus(
            name="database",
            status=HealthStatus.HEALTHY,
            latency_ms=round(latency, 2),
        )
    except Exception as exc:
        latency = (time.time() - start_time) * 1000
        # Log full exception internally for debugging
        logger.exception(f"Database health check failed")
        
        # Return sanitized error message (don't expose internal details)
        return DependencyStatus(
            name="database",
            status=HealthStatus.UNHEALTHY,
            latency_ms=round(latency, 2),
            error="database connection failed",
        )


async def check_redis() -> Optional[DependencyStatus]:
    """Check Redis connectivity.

    Returns None if Redis is not configured.
    """
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return None

    import time

    start_time = time.time()
    client = None

    try:
        # Try to import redis and check connection
        import redis.asyncio as redis

        client = redis.from_url(redis_url)
        await client.ping()

        latency = (time.time() - start_time) * 1000

        return DependencyStatus(
            name="redis",
            status=HealthStatus.HEALTHY,
            latency_ms=round(latency, 2),
        )
    except ImportError:
        return DependencyStatus(
            name="redis",
            status=HealthStatus.DEGRADED,
            error="Redis library not installed",
        )
    except Exception as exc:
        latency = (time.time() - start_time) * 1000
        # Log internally for debugging
        logger.warning(f"Redis health check failed: {exc}")

        # Return sanitized error (don't expose connection details)
        return DependencyStatus(
            name="redis",
            status=HealthStatus.UNHEALTHY,
            latency_ms=round(latency, 2),
            error="redis connection failed",
        )
    finally:
        # Always close the client
        if client is not None:
            try:
                await client.close()
            except Exception:
                pass  # Ignore errors during cleanup


async def check_all_dependencies() -> List[DependencyStatus]:
    """Check all dependencies and return their status."""
    dependencies = []

    # Check database (required)
    db_status = await check_database()
    dependencies.append(db_status)

    # Check Redis (optional)
    redis_status = await check_redis()
    if redis_status:
        dependencies.append(redis_status)

    return dependencies


def determine_overall_status(dependencies: List[DependencyStatus]) -> HealthStatus:
    """Determine overall health status from dependency statuses."""
    if not dependencies:
        return HealthStatus.HEALTHY

    # If any required dependency is unhealthy, the whole system is unhealthy
    for dep in dependencies:
        if dep.status == HealthStatus.UNHEALTHY:
            # Redis is optional, so it doesn't make the system unhealthy
            if dep.name == "redis":
                continue
            return HealthStatus.UNHEALTHY

    # If any dependency is degraded, the system is degraded
    for dep in dependencies:
        if dep.status == HealthStatus.DEGRADED:
            return HealthStatus.DEGRADED

    return HealthStatus.HEALTHY


# Router for health check endpoints
router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthCheckResponse)
async def health_check(response: Response):
    """Basic health check endpoint.

    Returns 200 if the application is running.
    Use /health/detailed for dependency status.
    """
    return HealthCheckResponse(
        status=HealthStatus.HEALTHY,
        uptime_seconds=get_uptime_seconds(),
    )


@router.get("/health/detailed", response_model=HealthCheckResponse)
async def detailed_health_check(response: Response):
    """Detailed health check with dependency status.

    Checks:
    - Database connectivity
    - Redis connectivity (if configured)

    Returns 503 if any required dependency is unhealthy.
    """
    dependencies = await check_all_dependencies()
    overall_status = determine_overall_status(dependencies)

    # Set appropriate HTTP status code
    if overall_status == HealthStatus.UNHEALTHY:
        response.status_code = 503
    elif overall_status == HealthStatus.DEGRADED:
        response.status_code = 200  # Still operational

    return HealthCheckResponse(
        status=overall_status,
        dependencies=dependencies,
        uptime_seconds=get_uptime_seconds(),
    )


@router.get("/health/ready", response_model=HealthCheckResponse)
async def readiness_check(response: Response):
    """Readiness check for Kubernetes.

    Returns 200 if the application is ready to receive traffic.
    This checks that all required dependencies are available.
    """
    dependencies = await check_all_dependencies()
    overall_status = determine_overall_status(dependencies)

    if overall_status != HealthStatus.HEALTHY:
        response.status_code = 503

    return HealthCheckResponse(
        status=overall_status,
        dependencies=dependencies,
        uptime_seconds=get_uptime_seconds(),
    )


@router.get("/health/live", response_model=HealthCheckResponse)
async def liveness_check():
    """Liveness check for Kubernetes.

    Returns 200 if the application process is alive.
    This does NOT check dependencies - use /health/ready for that.

    If this endpoint returns 200, Kubernetes knows the container
    is running and should not be restarted.
    """
    return HealthCheckResponse(
        status=HealthStatus.HEALTHY,
        uptime_seconds=get_uptime_seconds(),
    )
