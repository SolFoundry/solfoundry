from sqlalchemy import Column, Integer, String, Float, JSON
from app.db.base_class import Base

class Contributor(Base):
    __tablename__ = "contributors"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    reputation = Column(Integer, default=0)
    earnings = Column(Float, default=0.0)
    stats = Column(JSON, default=dict)
