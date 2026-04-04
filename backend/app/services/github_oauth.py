"""GitHub OAuth: build authorize URL, exchange code, fetch profile."""

from __future__ import annotations

import urllib.parse
from typing import Any

import httpx

from app.config import Settings


GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize"
GITHUB_ACCESS_TOKEN = "https://github.com/login/oauth/access_token"
GITHUB_USER_API = "https://api.github.com/user"
GITHUB_EMAILS_API = "https://api.github.com/user/emails"
DEFAULT_SCOPE = "read:user user:email"


def build_authorize_url(
    settings: Settings,
    state: str,
) -> str:
    params = urllib.parse.urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": settings.oauth_redirect_uri,
            "scope": DEFAULT_SCOPE,
            "state": state,
            "allow_signup": "true",
        }
    )
    return f"{GITHUB_AUTHORIZE}?{params}"


async def exchange_code_for_token(
    settings: Settings,
    code: str,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            GITHUB_ACCESS_TOKEN,
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.oauth_redirect_uri,
            },
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        if r.status_code == 403:
            raise RuntimeError("GitHub rate limited or blocked this request. Try again shortly.")
        if r.status_code >= 400:
            raise RuntimeError(f"GitHub token exchange failed ({r.status_code})")
        data = r.json()
        if "error" in data:
            err = data.get("error", "unknown_error")
            desc = data.get("error_description", "")
            if err in ("bad_verification_code", "incorrect_client_credentials"):
                raise ValueError(
                    "Authorization code is invalid, expired, or was already used. Start sign-in again."
                )
            raise ValueError(desc or err)
        return data


async def fetch_github_profile(access_token: str) -> dict[str, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {access_token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        ur = await client.get(GITHUB_USER_API, headers=headers)
        if ur.status_code == 403:
            raise RuntimeError("GitHub API rate limit exceeded. Try again later.")
        ur.raise_for_status()
        user = ur.json()
        email = user.get("email")
        if email is None:
            er = await client.get(GITHUB_EMAILS_API, headers=headers)
            if er.status_code == 200:
                emails = er.json()
                primary = next((e for e in emails if e.get("primary")), None)
                if primary:
                    email = primary.get("email")
                elif emails:
                    email = emails[0].get("email")
        return {**user, "resolved_email": email}
