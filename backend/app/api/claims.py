"""Bounty claiming API router (Issue #16).

Provides claim, release, approve, reject, and list-claims endpoints.
Mounted alongside the existing bounties CRUD router.
"""

from fastapi import APIRouter, HTTPException

from app.services.claim_service import (
    ClaimCreate,
    ClaimListResponse,
    ClaimResponse,
    claim_bounty,
    release_claim,
    approve_claim,
    reject_claim,
    list_claims,
)

router = APIRouter(prefix="/api/bounties", tags=["claims"])


@router.post(
    "/{bounty_id}/claims",
    response_model=ClaimResponse,
    status_code=201,
    summary="Claim a bounty",
)
async def create_claim(bounty_id: str, data: ClaimCreate) -> ClaimResponse:
    """Claim an open bounty for the given claimant."""
    result, error = claim_bounty(bounty_id, data)
    if error:
        code = 404 if "not found" in error.lower() else 409
        raise HTTPException(status_code=code, detail=error)
    return result


@router.get(
    "/{bounty_id}/claims",
    response_model=ClaimListResponse,
    summary="List claims for a bounty",
)
async def get_claims(bounty_id: str) -> ClaimListResponse:
    """List all claims (active, released, approved, rejected) for a bounty."""
    result, error = list_claims(bounty_id)
    if error:
        raise HTTPException(status_code=404, detail=error)
    return result


@router.post(
    "/{bounty_id}/claims/{claim_id}/release",
    response_model=ClaimResponse,
    summary="Release a claim",
)
async def release(bounty_id: str, claim_id: str) -> ClaimResponse:
    """Release an active claim, returning the bounty to OPEN status."""
    result, error = release_claim(claim_id)
    if error:
        code = 404 if "not found" in error.lower() else 409
        raise HTTPException(status_code=code, detail=error)
    return result


@router.post(
    "/{bounty_id}/claims/{claim_id}/approve",
    response_model=ClaimResponse,
    summary="Approve a claim",
)
async def approve(bounty_id: str, claim_id: str) -> ClaimResponse:
    """Approve an active claim, transitioning the bounty to COMPLETED."""
    result, error = approve_claim(claim_id)
    if error:
        code = 404 if "not found" in error.lower() else 409
        raise HTTPException(status_code=code, detail=error)
    return result


@router.post(
    "/{bounty_id}/claims/{claim_id}/reject",
    response_model=ClaimResponse,
    summary="Reject a claim",
)
async def reject(bounty_id: str, claim_id: str) -> ClaimResponse:
    """Reject an active claim, returning the bounty to OPEN status."""
    result, error = reject_claim(claim_id)
    if error:
        code = 404 if "not found" in error.lower() else 409
        raise HTTPException(status_code=code, detail=error)
    return result
