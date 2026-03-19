from sqlalchemy.orm import Session
from app.models.contributor import Contributor

def get_contributor_by_username(db: Session, username: str):
    return db.query(Contributor).filter(Contributor.username == username).first()
