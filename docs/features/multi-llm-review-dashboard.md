# Multi-LLM Review Dashboard
> Last updated: 2026-04-08
## Overview
The Multi-LLM Review Dashboard provides a unified interface for visualizing review scores from multiple AI models, along with an appeal mechanism for disputed submissions. This feature enhances the evaluation process by allowing users to see consensus indicators and engage in the appeal workflow.
## How It Works
The dashboard is implemented in `frontend/src/components/ReviewDashboard.jsx`, which fetches and displays scores from the backend. The appeal system is managed through `backend/api/appeals.py`, where users can submit appeals and assign reviewers. The integration of FastAPI allows for efficient handling of appeal requests.
## Configuration
No configuration required.
## Usage
To use the dashboard, navigate to the appropriate route in the frontend application. Users can view scores and submit appeals directly from the interface.
## References
- Closes issue #858