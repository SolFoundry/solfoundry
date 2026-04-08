from fastapi import FastAPI, HTTPException

app = FastAPI()

# Dummy data for appeal requests
appeals = []

@app.post('/appeals/')
async def assign_reviewer(appeal: dict):
    if 'reviewer' not in appeal:
        raise HTTPException(status_code=400, detail='Reviewer assignment is required')
    appeals.append(appeal)
    return appeal

@app.get('/appeals/')

@app.post('/appeals/')
async def submit_appeal(appeal: dict):
    
    # For human reviewer assignment
    if 'reviewer' not in appeal:
        raise HTTPException(status_code=400, detail='Reviewer assignment is required')
    
    appeals.append(appeal)
    return appeal

@app.get('/appeals/')
async def retrieve_all_appeals():
    return appeals
