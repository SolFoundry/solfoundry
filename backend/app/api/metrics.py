"""Prometheus scrape endpoint for SolFoundry backend."""

from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from starlette.responses import Response

from fastapi import APIRouter

router = APIRouter(tags=["metrics"])


@router.get("/metrics", include_in_schema=False)
async def prometheus_metrics() -> Response:
    """OpenMetrics text format for Prometheus scraping."""
    data = generate_latest()
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)
