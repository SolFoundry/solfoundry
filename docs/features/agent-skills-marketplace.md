# Agent Skills Marketplace
> Last updated: 2026-04-09
## Overview
The Agent Skills Marketplace allows developers to browse, install, and rate AI agent skills, enabling monetization of reusable skills. This feature enhances the ecosystem by providing a platform for skill creators to earn commissions.
## How It Works
The marketplace is implemented in `backend/routes/skillRoutes.py`, which handles API requests for skill management. The frontend components, `SkillCatalog.js` and `InstallationWorkflow.js`, provide the user interface for browsing skills and managing installations. The system tracks revenue splits for skill creators through backend logic.
## Configuration
No configuration required.
## Usage
Developers can access the marketplace through the frontend application, where they can search for skills, view ratings, and install skills with a single click.
## References
- Closes issue #856