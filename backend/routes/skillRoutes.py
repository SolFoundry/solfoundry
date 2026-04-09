from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

app = FastAPI()

class Skill(BaseModel):
    id: int
    name: str
    rating: float

skills = [
    Skill(id=1, name="Code Review", rating=4.7),
    Skill(id=2, name="Security Audit", rating=4.9),
]

@app.get("/api/skills", response_model=List[Skill])
async def get_skills():
    return skills

@app.post("/api/skills/{skill_id}/install")
async def install_skill(skill_id: int):
    # Placeholder for actual installation logic
    return {"message": "Skill installed successfully!"}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)