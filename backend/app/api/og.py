"""Dynamic Open Graph meta tags for social media previews.

Returns server-rendered HTML pages with OG/Twitter Card meta tags for
link previews on X, Discord, Telegram, and other platforms.

Crawlers that request ``/bounty/:id`` receive a minimal HTML page with
the correct ``og:title``, ``og:description``, and ``og:image`` tags.
Real browsers are redirected to the SPA which handles its own rendering.
"""

from __future__ import annotations

import html
import logging

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["og"])

SITE_URL = "https://solfoundry.org"
DEFAULT_OG_IMAGE = f"{SITE_URL}/og-default.png"
TWITTER_SITE = "@SolFoundry"

# Common social-media and search-engine bot user-agent substrings.
BOT_SIGNATURES = (
    "Twitterbot",
    "facebookexternalhit",
    "LinkedInBot",
    "Slackbot",
    "Discordbot",
    "TelegramBot",
    "WhatsApp",
    "Googlebot",
    "bingbot",
    "Baiduspider",
    "YandexBot",
)


def _is_bot(request: Request) -> bool:
    """Return True if the request comes from a known social-media crawler."""
    ua = (request.headers.get("user-agent") or "").lower()
    return any(sig.lower() in ua for sig in BOT_SIGNATURES)


def _og_html(
    *,
    title: str,
    description: str,
    url: str,
    image: str = DEFAULT_OG_IMAGE,
) -> str:
    """Build a minimal HTML page with OG and Twitter Card meta tags."""
    t = html.escape(title)
    d = html.escape(description)
    u = html.escape(url)
    i = html.escape(image)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>{t}</title>
  <meta name="description" content="{d}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{t}" />
  <meta property="og:description" content="{d}" />
  <meta property="og:image" content="{i}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="{u}" />
  <meta property="og:site_name" content="SolFoundry" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="{TWITTER_SITE}" />
  <meta name="twitter:title" content="{t}" />
  <meta name="twitter:description" content="{d}" />
  <meta name="twitter:image" content="{i}" />

  <!-- Redirect browsers to the SPA -->
  <meta http-equiv="refresh" content="0; url={u}" />
</head>
<body>
  <p>Redirecting to <a href="{u}">{t}</a>...</p>
</body>
</html>"""


@router.get("/og/bounty/{bounty_id}", response_class=HTMLResponse)
async def og_bounty(bounty_id: int, request: Request) -> HTMLResponse:
    """Serve OG meta tags for a specific bounty.

    Social-media crawlers receive a server-rendered HTML page with meta tags.
    Regular browsers get a redirect to the SPA bounty page.
    """
    spa_url = f"{SITE_URL}/bounty/{bounty_id}"

    if not _is_bot(request):
        return HTMLResponse(
            content=f'<html><head><meta http-equiv="refresh" content="0; url={spa_url}" /></head></html>',
            status_code=200,
        )

    # Try to fetch bounty details from the database for dynamic tags.
    title = f"Bounty #{bounty_id} — SolFoundry"
    description = "Open bounty on SolFoundry. Earn $FNDRY by shipping code."

    try:
        from app.services.pg_store import get_bounty_by_id

        bounty = await get_bounty_by_id(bounty_id)
        if bounty:
            title = f"{bounty.title} — SolFoundry"
            reward = getattr(bounty, "reward_amount", None)
            tier = getattr(bounty, "tier", None)
            parts = []
            if reward:
                parts.append(f"Reward: {reward:,} $FNDRY")
            if tier:
                parts.append(f"Tier {tier}")
            parts.append("Earn $FNDRY by shipping code on SolFoundry.")
            description = " · ".join(parts)
    except Exception:
        logger.debug("Could not fetch bounty %s for OG tags", bounty_id)

    return HTMLResponse(
        content=_og_html(title=title, description=description, url=spa_url),
        status_code=200,
    )
