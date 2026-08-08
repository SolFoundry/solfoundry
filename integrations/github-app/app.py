"""FastAPI application for the AI Code Review GitHub App webhook handler."""

import hashlib
import hmac
import json
import logging
import os
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from .config import AppConfig, ReviewConfig
from .github_client import GitHubAppClient
from .models import DiffFile
from .reviewers import ReviewOrchestrator

logger = logging.getLogger(__name__)

app = FastAPI(title="SolFoundry AI Code Review", version="0.1.0")

# Module-level config (populated via env vars or startup)
_config: Optional[AppConfig] = None
_client: Optional[GitHubAppClient] = None


def get_config() -> AppConfig:
    global _config
    if _config is None:
        _config = AppConfig(
            github_app_id=os.getenv("GITHUB_APP_ID", ""),
            github_private_key=os.getenv("GITHUB_PRIVATE_KEY", ""),
            github_webhook_secret=os.getenv("GITHUB_WEBHOOK_SECRET", ""),
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
            openai_api_key=os.getenv("OPENAI_API_KEY", ""),
            gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        )
    return _config


def get_client() -> GitHubAppClient:
    global _client
    cfg = get_config()
    if _client is None:
        _client = GitHubAppClient(cfg.github_app_id, cfg.github_private_key)
    return _client


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify the X-Hub-Signature-256 header."""
    cfg = get_config()
    if not cfg.github_webhook_secret:
        return True  # Skip verification if no secret configured
    expected = "sha256=" + hmac.new(
        cfg.github_webhook_secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def parse_diff(diff_text: str) -> list[DiffFile]:
    """Parse a unified diff response into DiffFile objects."""
    files = []
    current_file = None
    current_patch = []
    adds = 0
    dels = 0

    for line in diff_text.splitlines():
        if line.startswith("diff --git a/"):
            if current_file:
                files.append(DiffFile(
                    filename=current_file,
                    patch="\n".join(current_patch),
                    additions=adds,
                    deletions=dels,
                ))
            current_file = line.split(" b/", 1)[-1] if " b/" in line else line.split()[-1]
            current_patch = [line]
            adds = 0
            dels = 0
        elif line.startswith("@@") and current_file is not None:
            current_patch.append(line)
        elif current_file is not None:
            current_patch.append(line)
            if line.startswith("+"):
                adds += 1
            elif line.startswith("-"):
                dels += 1

    if current_file:
        files.append(DiffFile(
            filename=current_file,
            patch="\n".join(current_patch),
            additions=adds,
            deletions=dels,
        ))
    return files


@app.on_event("startup")
async def startup():
    get_config()
    get_client()
    logger.info("AI Code Review GitHub App started")


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ai-code-review"}


@app.post("/webhook")
async def webhook(request: Request):
    """Handle GitHub App webhook events."""
    body = await request.body()
    sig = request.headers.get("X-Hub-Signature-256", "")
    if not verify_webhook_signature(body, sig):
        raise HTTPException(status_code=401, detail="Invalid signature")

    event = request.headers.get("X-GitHub-Event", "")
    if event != "pull_request":
        return JSONResponse({"status": "skipped", "reason": f"unhandled event: {event}"})

    payload = json.loads(body)
    action = payload.get("action", "")
    if action not in ("opened", "synchronize", "reopened"):
        return JSONResponse({"status": "skipped", "reason": f"unhandled action: {action}"})

    pr = payload.get("pull_request", {})
    repo = payload.get("repository", {})
    installation = payload.get("installation", {})

    repo_full_name = repo.get("full_name", "")
    pr_number = pr.get("number", 0)
    head_sha = pr.get("head", {}).get("sha", "")
    installation_id = installation.get("id", 0)

    if not all([repo_full_name, pr_number, head_sha, installation_id]):
        raise HTTPException(status_code=400, detail="Missing required fields")

    try:
        client = get_client()
        diff_text = await client.get_pull_request_diff(installation_id, repo_full_name, pr_number)
        files = await parse_diff(diff_text)

        # Check for repo-specific config
        repo_config = await client.get_repo_config(installation_id, repo_full_name)
        config = ReviewConfig()
        if repo_config:
            config = ReviewConfig(**{k: v for k, v in repo_config.items() if k in ReviewConfig.model_fields})

        # Run the review
        orchestrator = ReviewOrchestrator(config)
        result = await orchestrator.run(files)

        # Submit review comments
        comments = [f.to_line_comment() for f in result.findings if f.file and f.line]
        await client.submit_review(
            installation_id, repo_full_name, pr_number,
            body=result.summary,
            comments=comments[:20],  # Max 20 inline comments
            event="COMMENT",
        )

        # Create a check run
        conclusion = "success" if result.score >= config.get_score_threshold() else "neutral"
        await client.create_check_run(
            installation_id, repo_full_name, head_sha,
            name="AI Code Review (SolFoundry)",
            status="completed",
            conclusion=conclusion,
            output={
                "title": f"Score: {result.score}/10",
                "summary": result.summary,
                "text": f"Models: {json.dumps(result.model_scores)}\nFindings: {len(result.findings)} total",
            },
        )

        return JSONResponse({
            "status": "completed",
            "score": result.score,
            "findings": len(result.findings),
            "conclusion": conclusion,
        })
    except Exception as e:
        logger.exception("Review failed")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)