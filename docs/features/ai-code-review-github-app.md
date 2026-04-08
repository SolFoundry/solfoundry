# AI Code Review GitHub App
> Last updated: 2026-04-08
## Overview
The AI Code Review GitHub App automates the code review process for pull requests by utilizing multiple AI models to provide comprehensive evaluations. This feature was developed to enhance code quality and streamline the review process across repositories.
## How It Works
The app integrates with GitHub's pull request workflow, triggering reviews from AI models such as Claude, Codex, and Gemini. The review process includes security checks, performance analysis, and adherence to coding standards. Key files involved include `.github/workflows/pr-review.yml` for the review workflow and `.github/PULL_REQUEST_TEMPLATE.md` for the PR submission template.
## Configuration
No configuration required.
## Usage
To use the app, install it in your GitHub repository and create a pull request. The app will automatically initiate a review and provide feedback in the comments section.
## References
- Closes issue #862