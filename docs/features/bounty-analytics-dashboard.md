# Bounty Analytics Dashboard
> Last updated: 2026-04-08
## Overview
The Bounty Analytics Dashboard provides insights into bounty trends, payout distributions, contributor growth, and completion rates. This feature was developed to enhance the visibility of bounty-related metrics and facilitate data-driven decision-making.
## How It Works
The dashboard is implemented in `backend/main.py`, where new endpoints were added to fetch analytics data. The frontend interacts with these endpoints to display the data in a user-friendly format. The analytics data can also be exported in CSV and PDF formats.
## Configuration
No configuration required.
## Usage
To access the dashboard, navigate to `/api/analytics` in your browser after starting the server. You can also trigger report downloads via the dashboard interface.
## References
- Closes issue #859