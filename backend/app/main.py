"""SolFoundry Backend API."""

from fastapi import FastAPI

app = FastAPI(title="SolFoundry API")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Welcome to SolFoundry API"}
