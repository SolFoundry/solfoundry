"""FastAPI router for AI bounty description enhancement."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, HTTPException

from .enhancer import BountyEnhancer, EnhancedBounty
from .approval_workflow import ApprovalWorkflow

router = APIRouter(prefix="/api/ai-enhance", tags=["ai-enhancer"])

# Module-level singletons — wire up with DI in production
_workflow = ApprovalWorkflow()
_enhancer = BountyEnhancer()


# ── Trigger enhancement ──────────────────────────────────────────────
@router.post("/{bounty_id}")
async def trigger_enhancement(bounty_id: str, bounty: dict[str, Any]) -> dict[str, Any]:
    """Trigger AI enhancement for a bounty description."""
    bounty["id"] = bounty_id
    result: EnhancedBounty = await _enhancer.enhance_description(bounty)

    if result.error:
        raise HTTPException(status_code=502, detail=result.error)

    data = asdict(result)
    _workflow.submit(bounty_id, data)
    return {"status": "pending", "enhancement": data}


# ── Check status ─────────────────────────────────────────────────────
@router.get("/{bounty_id}/status")
async def get_status(bounty_id: str) -> dict[str, Any]:
    """Check the enhancement/approval status for a bounty."""
    status = _workflow.get_status(bounty_id)
    if status is None:
        raise HTTPException(status_code=404, detail="No enhancement found for this bounty")
    return {"bounty_id": bounty_id, "status": status.value}


# ── Approve ──────────────────────────────────────────────────────────
@router.post("/{bounty_id}/approve")
async def approve_enhancement(bounty_id: str, reviewer: str = "maintainer") -> dict[str, Any]:
    """Approve an enhanced bounty description and publish it."""
    try:
        req = _workflow.approve(bounty_id, reviewer)
    except KeyError:
        raise HTTPException(status_code=404, detail="No enhancement found")
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {"bounty_id": bounty_id, "status": req.status.value, "reviewer": reviewer}


# ── Reject ───────────────────────────────────────────────────────────
@router.post("/{bounty_id}/reject")
async def reject_enhancement(bounty_id: str, reviewer: str = "maintainer") -> dict[str, Any]:
    """Reject an enhanced bounty description and revert."""
    try:
        req = _workflow.reject(bounty_id, reviewer)
    except KeyError:
        raise HTTPException(status_code=404, detail="No enhancement found")
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {"bounty_id": bounty_id, "status": req.status.value, "reviewer": reviewer}
