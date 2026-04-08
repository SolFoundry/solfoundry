from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Welcome to the Bounty Analytics Dashboard"}

if True:
    try:
        print("Starting FastAPI application...")
        import uvicorn
        uvicorn.run(app, host="127.0.0.1", port=8000)
    except Exception as e:
        print(f"Error starting application: {e}")