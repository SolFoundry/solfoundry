"""API routes for bounty enhancement"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.llm_service import enhance_bounty

router = APIRouter(prefix="/api", tags=["enhance"])


class EnhanceRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Bounty title")
    description: str = Field(
        ..., min_length=1, max_length=5000, description="Bounty description"
    )
    use_mock: bool = Field(
        False, description="Use mock data instead of real LLM calls"
    )


class EnhancementResult(BaseModel):
    style: str
    model: str
    enhanced_title: str
    enhanced_description: str
    acceptance_criteria: list[str] = []
    examples: list[str] = []


class EnhanceResponse(BaseModel):
    success: bool
    originals: dict = {"title": "", "description": ""}
    enhancements: list[EnhancementResult] = []
    message: str = ""


@router.post("/enhance-bounty", response_model=EnhanceResponse)
async def enhance_bounty_endpoint(req: EnhanceRequest):
    """
    Enhance a bounty description using multi-LLM parallel calls.
    Returns 3 enhanced versions from different LLM "personalities".
    """
    try:
        enhancements = await enhance_bounty(
            title=req.title, description=req.description, use_mock=req.use_mock
        )

        return EnhanceResponse(
            success=True,
            originals={"title": req.title, "description": req.description},
            enhancements=[EnhancementResult(**e) for e in enhancements],
            message=f"Generated {len(enhancements)} enhancements",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
