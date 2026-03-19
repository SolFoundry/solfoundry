from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.contributor import Contributor

router = APIRouter()

@router.get("/{username}")
def get_contributor_profile(username: str, db: Session = Depends(deps.get_db)):
    contributor = db.query(Contributor).filter(Contributor.username == username).first()
    if not contributor:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return {
        "id": contributor.id,
        "username": contributor.username,
        "reputation": contributor.reputation,
        "earnings": contributor.earnings,
        "stats": contributor.stats
    }
