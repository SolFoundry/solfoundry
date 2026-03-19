from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Optional
from datetime import datetime
from enum import Enum
import uuid

app = FastAPI(
    title="Bounty Management API",
    description="API for managing bounties and rewards",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BountyStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class BountyPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class BountyCreate(BaseModel):
    title: str
    description: str
    reward_amount: float
    priority: BountyPriority = BountyPriority.MEDIUM
    deadline: Optional[datetime] = None
    tags: List[str] = []

    @validator('title')
    def validate_title(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError('Title must be at least 3 characters long')
        if len(v.strip()) > 200:
            raise ValueError('Title must be less than 200 characters')
        return v.strip()

    @validator('description')
    def validate_description(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError('Description must be at least 10 characters long')
        if len(v.strip()) > 5000:
            raise ValueError('Description must be less than 5000 characters')
        return v.strip()

    @validator('reward_amount')
    def validate_reward_amount(cls, v):
        if v <= 0:
            raise ValueError('Reward amount must be greater than 0')
        if v > 1000000:
            raise ValueError('Reward amount must be less than 1,000,000')
        return round(v, 2)

    @validator('deadline')
    def validate_deadline(cls, v):
        if v and v <= datetime.now():
            raise ValueError('Deadline must be in the future')
        return v

class BountyUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    reward_amount: Optional[float] = None
    priority: Optional[BountyPriority] = None
    status: Optional[BountyStatus] = None
    deadline: Optional[datetime] = None
    tags: Optional[List[str]] = None

    @validator('title')
    def validate_title(cls, v):
        if v is not None:
            if not v or len(v.strip()) < 3:
                raise ValueError('Title must be at least 3 characters long')
            if len(v.strip()) > 200:
                raise ValueError('Title must be less than 200 characters')
            return v.strip()
        return v

    @validator('description')
    def validate_description(cls, v):
        if v is not None:
            if not v or len(v.strip()) < 10:
                raise ValueError('Description must be at least 10 characters long')
            if len(v.strip()) > 5000:
                raise ValueError('Description must be less than 5000 characters')
            return v.strip()
        return v

    @validator('reward_amount')
    def validate_reward_amount(cls, v):
        if v is not None:
            if v <= 0:
                raise ValueError('Reward amount must be greater than 0')
            if v > 1000000:
                raise ValueError('Reward amount must be less than 1,000,000')
            return round(v, 2)
        return v

    @validator('deadline')
    def validate_deadline(cls, v):
        if v is not None and v <= datetime.now():
            raise ValueError('Deadline must be in the future')
        return v

class Bounty(BaseModel):
    id: str
    title: str
    description: str
    reward_amount: float
    priority: BountyPriority
    status: BountyStatus
    deadline: Optional[datetime]
    tags: List[str]
    created_at: datetime
    updated_at: datetime

# In-memory storage (replace with database in production)
bounties_db = {}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}

@app.post("/bounties", response_model=Bounty, status_code=status.HTTP_201_CREATED)
async def create_bounty(bounty_data: BountyCreate):
    try:
        bounty_id = str(uuid.uuid4())
        now = datetime.now()
        
        bounty = Bounty(
            id=bounty_id,
            title=bounty_data.title,
            description=bounty_data.description,
            reward_amount=bounty_data.reward_amount,
            priority=bounty_data.priority,
            status=BountyStatus.OPEN,
            deadline=bounty_data.deadline,
            tags=bounty_data.tags,
            created_at=now,
            updated_at=now
        )
        
        bounties_db[bounty_id] = bounty
        return bounty
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@app.get("/bounties", response_model=List[Bounty])
async def get_bounties(
    status_filter: Optional[BountyStatus] = None,
    priority_filter: Optional[BountyPriority] = None,
    limit: int = 50,
    offset: int = 0
):
    try:
        if limit < 1 or limit > 100:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Limit must be between 1 and 100")
        if offset < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Offset must be non-negative")
        
        bounties = list(bounties_db.values())
        
        # Apply filters
        if status_filter:
            bounties = [b for b in bounties if b.status == status_filter]
        if priority_filter:
            bounties = [b for b in bounties if b.priority == priority_filter]
        
        # Sort by created_at descending
        bounties.sort(key=lambda x: x.created_at, reverse=True)
        
        # Apply pagination
        return bounties[offset:offset + limit]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@app.get("/bounties/{bounty_id}", response_model=Bounty)
async def get_bounty(bounty_id: str):
    try:
        if bounty_id not in bounties_db:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bounty not found")
        return bounties_db[bounty_id]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@app.put("/bounties/{bounty_id}", response_model=Bounty)
async def update_bounty(bounty_id: str, bounty_data: BountyUpdate):
    try:
        if bounty_id not in bounties_db:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bounty not found")
        
        existing_bounty = bounties_db[bounty_id]
        
        # Check if bounty can be updated based on status
        if existing_bounty.status == BountyStatus.COMPLETED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot update completed bounty")
        
        # Update fields
        update_data = bounty_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(existing_bounty, field, value)
        
        existing_bounty.updated_at = datetime.now()
        bounties_db[bounty_id] = existing_bounty
        
        return existing_bounty
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@app.delete("/bounties/{bounty_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bounty(bounty_id: str):
    try:
        if bounty_id not in bounties_db:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bounty not found")
        
        existing_bounty = bounties_db[bounty_id]
        
        # Check if bounty can be deleted based on status
        if existing_bounty.status == BountyStatus.IN_PROGRESS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete bounty in progress")
        
        del bounties_db[bounty_id]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@app.patch("/bounties/{bounty_id}/status", response_model=Bounty)
async def update_bounty_status(bounty_id: str, status: BountyStatus):
    try:
        if bounty_id not in bounties_db:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bounty not found")
        
        existing_bounty = bounties_db[bounty_id]
        
        # Validate status transitions
        current_status = existing_bounty.status
        valid_transitions = {
            BountyStatus.OPEN: [BountyStatus.IN_PROGRESS, BountyStatus.CANCELLED],
            BountyStatus.IN_PROGRESS: [BountyStatus.COMPLETED, BountyStatus.OPEN],
            BountyStatus.COMPLETED: [],
            BountyStatus.CANCELLED: [BountyStatus.OPEN]
        }
        
        if status not in valid_transitions.get(current_status, []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status transition from {current_status} to {status}"
            )
        
        existing_bounty.status = status
        existing_bounty.updated_at = datetime.now()
        bounties_db[bounty_id] = existing_bounty
        
        return existing_bounty
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)