"""Developer portal — getting-started guide served at /docs/getting-started."""

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["admin"])

_GUIDE_TEMPLATE = Path(__file__).parent.parent / "templates" / "developer_guide.html"


@router.get(
    "/docs/getting-started",
    response_class=HTMLResponse,
    include_in_schema=False,
    summary="Developer getting-started guide",
)
async def developer_guide():
    """Serve the interactive developer portal / getting-started guide."""
    return HTMLResponse(content=_GUIDE_TEMPLATE.read_text(encoding="utf-8"))
