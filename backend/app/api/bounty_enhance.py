"""AI Bounty Description Enhancer API router (Issue #848).

Endpoints:
- POST /api/bounties/{bounty_id}/enhance — Trigger AI-powered description enhancement
- GET /api/bounties/{bounty_id}/enhancements — List all enhancement records
- GET /api/bounties/{bounty_id}/enhancements/{enhancement_id} — Get a specific enhancement
- POST /api/bounties/{bounty_id}/enhancements/{enhancement_id}/approve — Approve an enhancement
- POST /api/bounties/{bounty_id}/enhancements/{enhancement_id}/reject — Reject an enhancement
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.models.bounty_enhance import (
    EnhanceApproval,
    EnhanceRequest,
    EnhanceResponse,
    EnhancementListResponse,
    EnhancementRecord,
    LLMProvider,
)
from app.models.errors import ErrorResponse
from app.services.bounty_service import get_bounty
from app.services import bounty_enhancer_service
from app.services.bounty_service import update_bounty
from app.models.bounty import BountyUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bounties", tags=["bounty-enhance"])


@router.post(
    "/{bounty_id}/enhance",
    response_model=EnhanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Enhance a bounty description using AI",
    description="Analyzes a bounty description using multiple LLM providers (Claude, Codex, Gemini) "
    "and generates improved versions with clearer requirements, acceptance criteria, and examples. "
    "Results are stored for maintainer review.",
    responses={
        404: {"model": ErrorResponse, "description": "Bounty not found"},
        400: {"model": ErrorResponse, "description": "Bounty description is empty"},
    },
)
async def enhance_bounty_description(
    bounty_id: str,
    request: EnhanceRequest,
) -> EnhanceResponse:
    """Trigger AI-powered enhancement of a bounty description.

    Args:
        bounty_id: The UUID of the bounty to enhance.
        request: The enhancement request payload (providers + custom prompt).

    Returns:
        EnhanceResponse with results from each configured LLM provider.

    Raises:
        HTTPException 404: If the bounty is not found.
        HTTPException 400: If the bounty has no description to enhance.
    """
    # Fetch the bounty
    bounty = await get_bounty(bounty_id)
    if not bounty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bounty with ID '{bounty_id}' not found",
        )

    # Check that the bounty has a description
    if not bounty.description or not bounty.description.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bounty has no description to enhance. Add a description first.",
        )

    # Enhance the description
    result = await bounty_enhancer_service.enhance_bounty_description(
        bounty_id=bounty_id,
        title=bounty.title,
        description=bounty.description,
        request=request,
        created_by="api",
    )

    return result


@router.get(
    "/{bounty_id}/enhancements",
    response_model=EnhancementListResponse,
    summary="List all enhancement records for a bounty",
    description="Returns all AI-generated description enhancement records for a specific bounty, "
    "ordered newest first.",
    responses={
        404: {"model": ErrorResponse, "description": "Bounty not found"},
    },
)
async def list_enhancements(
    bounty_id: str,
) -> EnhancementListResponse:
    """List all AI description enhancement records for a bounty.

    Args:
        bounty_id: The UUID of the bounty.

    Returns:
        EnhancementListResponse with all enhancement records (newest first).

    Raises:
        HTTPException 404: If the bounty is not found.
    """
    # Verify bounty exists
    bounty = await get_bounty(bounty_id)
    if not bounty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bounty with ID '{bounty_id}' not found",
        )

    return await bounty_enhancer_service.get_enhancements_for_bounty(bounty_id)


@router.get(
    "/{bounty_id}/enhancements/{enhancement_id}",
    response_model=EnhancementRecord,
    summary="Get a specific enhancement record",
    description="Returns a single AI description enhancement record by its ID.",
    responses={
        404: {"model": ErrorResponse, "description": "Enhancement record not found"},
    },
)
async def get_enhancement(
    bounty_id: str,
    enhancement_id: str,
) -> EnhancementRecord:
    """Get a specific enhancement record.

    Args:
        bounty_id: The UUID of the bounty.
        enhancement_id: The ID of the enhancement record.

    Returns:
        The EnhancementRecord with full details.

    Raises:
        HTTPException 404: If the enhancement record is not found.
    """
    record = await bounty_enhancer_service.get_enhancement(bounty_id, enhancement_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Enhancement record '{enhancement_id}' not found for bounty '{bounty_id}'",
        )
    return record


@router.post(
    "/{bounty_id}/enhancements/{enhancement_id}/approve",
    response_model=EnhancementRecord,
    summary="Approve an AI-generated enhancement",
    description="Approve a specific LLM provider's enhancement result and apply it to the bounty. "
    "The bounty's title and description will be updated with the approved version.",
    responses={
        404: {"model": ErrorResponse, "description": "Enhancement record not found"},
        400: {"model": ErrorResponse, "description": "Invalid approval request"},
    },
)
async def approve_enhancement(
    bounty_id: str,
    enhancement_id: str,
    approval: EnhanceApproval,
) -> EnhancementRecord:
    """Approve an AI-generated enhancement and apply it to the bounty.

    The request body must specify which LLM provider's result to use
    (e.g., 'claude', 'codex', or 'gemini').

    Args:
        bounty_id: The UUID of the bounty.
        enhancement_id: The ID of the enhancement record.
        approval: The approval payload with provider selection.

    Returns:
        The updated EnhancementRecord with the approved result.

    Raises:
        HTTPException 404: If the enhancement record is not found.
        HTTPException 400: If the provider's result has an error or is invalid.
    """
    if approval.action != "approve":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use the /reject endpoint for rejection. This endpoint requires action='approve'.",
        )

    # The enhancement service expects a provider in the body
    # We'll use the first non-error provider as default
    record = await bounty_enhancer_service.get_enhancement(bounty_id, enhancement_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Enhancement record '{enhancement_id}' not found for bounty '{bounty_id}'",
        )

    # Find the first successful provider result
    selected_provider = None
    for result in record.results:
        if result.error is None:
            selected_provider = result.provider
            break

    if not selected_provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No successful enhancement results available to approve. "
            "All providers returned errors.",
        )

    # Approve the enhancement
    updated_record = await bounty_enhancer_service.approve_enhancement(
        bounty_id=bounty_id,
        enhancement_id=enhancement_id,
        provider=selected_provider,
    )

    if not updated_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Enhancement record '{enhancement_id}' not found",
        )

    # Apply the enhancement to the bounty
    if updated_record.selected_result:
        await update_bounty(
            bounty_id=bounty_id,
            data=BountyUpdate(
                title=updated_record.selected_result.enhanced_title,
                description=updated_record.selected_result.enhanced_description,
            ),
        )
        logger.info(
            "Bounty %s description enhanced (provider: %s, enhancement: %s)",
            bounty_id,
            selected_provider.value,
            enhancement_id,
        )

    return updated_record


@router.post(
    "/{bounty_id}/enhancements/{enhancement_id}/reject",
    response_model=EnhancementRecord,
    summary="Reject an AI-generated enhancement",
    description="Reject an AI-generated description enhancement without applying it.",
    responses={
        404: {"model": ErrorResponse, "description": "Enhancement record not found"},
    },
)
async def reject_enhancement(
    bounty_id: str,
    enhancement_id: str,
) -> EnhancementRecord:
    """Reject an AI-generated description enhancement.

    The enhancement is marked as rejected and the bounty description is
    not modified.

    Args:
        bounty_id: The UUID of the bounty.
        enhancement_id: The ID of the enhancement record.

    Returns:
        The updated EnhancementRecord with rejected status.

    Raises:
        HTTPException 404: If the enhancement record is not found.
    """
    record = await bounty_enhancer_service.reject_enhancement(
        bounty_id=bounty_id,
        enhancement_id=enhancement_id,
    )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Enhancement record '{enhancement_id}' not found for bounty '{bounty_id}'",
        )

    logger.info(
        "Bounty %s enhancement %s rejected",
        bounty_id,
        enhancement_id,
    )

    return record