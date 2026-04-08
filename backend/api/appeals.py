from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException

app = FastAPI()

appeals: List[Dict[str, Any]] = []


@app.post("/appeals/")
async def submit_appeal(appeal: Dict[str, Any]) -> Dict[str, Any]:
    if "reviewer" not in appeal:
        raise HTTPException(
            status_code=400,
            detail="Reviewer assignment is required",
        )
    appeals.append(appeal)
    return appeal


@app.get("/appeals/")
async def retrieve_all_appeals() -> List[Dict[str, Any]]:
    return appeals
