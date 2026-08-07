"""HTML email templates for SolFoundry bounty notifications.

Each function returns a full HTML string ready to be sent via SendGrid
or the local dev fallback.
"""

from __future__ import annotations

from typing import Sequence

_BASE_STYLES = """
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #0b0d15; color: #e8e8e8; }
  .container { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .header { text-align: center; padding-bottom: 24px; border-bottom: 1px solid #2a2d3a; }
  .header h1 { font-size: 20px; font-weight: 700; color: #a78bfa; margin: 0; }
  .header p { color: #9ca3af; font-size: 14px; margin: 4px 0 0; }
  .card { background: #1a1d2e; border-radius: 12px; padding: 24px; margin: 20px 0; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
  .badge-t1 { background: #a78bfa20; color: #a78bfa; border: 1px solid #a78bfa40; }
  .badge-t2 { background: #60a5fa20; color: #60a5fa; border: 1px solid #60a5fa40; }
  .badge-t3 { background: #f59e0b20; color: #f59e0b; border: 1px solid #f59e0b40; }
  .btn { display: inline-block; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
  .btn-primary { background: #a78bfa; color: #0b0d15; }
  .footer { text-align: center; color: #6b7280; font-size: 12px; padding-top: 24px; border-top: 1px solid #2a2d3a; margin-top: 24px; }
  .footer a { color: #a78bfa; text-decoration: none; }
  .skill-tag { display: inline-block; padding: 2px 8px; background: #2a2d3a; border-radius: 4px; font-size: 12px; margin: 2px; }
  .status-ok { color: #34d399; }
  .status-warn { color: #f59e0b; }
  .status-err { color: #ef4444; }
  .reward { font-size: 28px; font-weight: 800; color: #a78bfa; }
  .muted { color: #9ca3af; }
</style>
"""


def _wrap(title: str, body: str, unsubscribe_token: str | None = None) -> str:
    unsubscribe = ""
    if unsubscribe_token:
        unsubscribe = (
            f'<p style="margin-top: 8px;">'
            f'<a href="{{{{UNSUBSCRIBE_URL}}}}?token={unsubscribe_token}" '
            f'style="color: #6b7280; font-size: 12px;">Unsubscribe from these emails</a></p>'
        )
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">{_BASE_STYLES}</head>
<body>
<div class="container">
  <div class="header">
    <h1>⚡ SolFoundry</h1>
    <p>Autonomous AI Software Factory on Solana</p>
  </div>
  {body}
  <div class="footer">
    <p>Built on Solana — Bounty coordination, multi-LLM review, reputation system</p>
    <p><a href="{{{{BOUNTIES_URL}}}}">Browse all bounties</a></p>
    {unsubscribe}
  </div>
</div>
</body>
</html>"""


def new_bounty_email(
    username: str,
    bounty_title: str,
    bounty_tier: str,
    reward: str,
    skills: Sequence[str],
    bounty_url: str,
) -> str:
    """Email template for a new bounty notification."""
    tier_class = {"t1": "badge-t1", "t2": "badge-t2", "t3": "badge-t3"}.get(
        bounty_tier.lower(), "badge-t2"
    )
    skills_html = "".join(
        f'<span class="skill-tag">{s}</span>' for s in skills
    ) if skills else ""

    body = f"""
    <div class="card">
      <p>Hey {username},</p>
      <p>A new bounty matching your interests has been posted!</p>
      <h2 style="font-size: 18px; margin: 16px 0 8px;">{bounty_title}</h2>
      <p>
        <span class="badge {tier_class}">{bounty_tier.upper()}</span>
        <span class="reward">{reward}</span>
      </p>
      {f'<p style="margin: 12px 0;">{skills_html}</p>' if skills_html else ""}
      <p style="text-align: center; margin: 24px 0 0;">
        <a class="btn btn-primary" href="{bounty_url}">View Bounty</a>
      </p>
    </div>
    """
    return _wrap("🔨 New Bounty", body)


def bounty_status_email(
    username: str,
    bounty_title: str,
    status: str,
    details: str,
    bounty_url: str,
) -> str:
    """Email template for a bounty status change."""
    status_icon = {"approved": "✅", "changes_requested": "🔄", "merged": "🎉", "cancelled": "🚫"}.get(
        status.lower(), "📋"
    )
    status_class = {
        "approved": "status-ok",
        "merged": "status-ok",
        "changes_requested": "status-warn",
        "cancelled": "status-err",
    }.get(status.lower(), "")

    body = f"""
    <div class="card">
      <p>Hey {username},</p>
      <p>Your submission for <strong>{bounty_title}</strong> has been updated:</p>
      <p style="font-size: 16px; margin: 16px 0;">
        <span class="{status_class}">{status_icon} <strong>{status.replace("_", " ").title()}</strong></span>
      </p>
      <p class="muted">{details}</p>
      <p style="text-align: center; margin: 24px 0 0;">
        <a class="btn btn-primary" href="{bounty_url}">View Submission</a>
      </p>
    </div>
    """
    return _wrap("📋 Bounty Update", body)


def payout_email(
    username: str,
    bounty_title: str,
    amount: str,
    tx_url: str,
) -> str:
    """Email template for a payout confirmation."""
    body = f"""
    <div class="card" style="text-align: center;">
      <p style="font-size: 48px; margin: 0;">💰</p>
      <p>Hey {username},</p>
      <p>Your bounty <strong>{bounty_title}</strong> has been paid out!</p>
      <p class="reward" style="font-size: 36px; margin: 16px 0;">{amount}</p>
      <p class="muted" style="font-size: 13px;">Transaction on Solana</p>
      <p style="text-align: center; margin: 24px 0 0;">
        <a class="btn btn-primary" href="{tx_url}">View Transaction</a>
      </p>
    </div>
    """
    return _wrap("💰 Payout Received", body)


def digest_email(
    username: str,
    new_bounties: Sequence[dict],
    completed_bounties: Sequence[dict],
    bounties_url: str,
    digest_type: str = "weekly",
) -> str:
    """Email template for a weekly/daily digest.

    Each dict in *new_bounties* should have keys: ``title``, ``tier``, ``reward``, ``url``.
    Each dict in *completed_bounties* should have keys: ``title``, ``reward``, ``url``.
    """
    lines = []
    if new_bounties:
        lines.append(
            f'<h3 style="color: #a78bfa; margin: 20px 0 12px;">'
            f'🆕 New Bounties ({len(new_bounties)})</h3>'
        )
        for b in new_bounties:
            tier_class = {"t1": "badge-t1", "t2": "badge-t2", "t3": "badge-t3"}.get(
                b.get("tier", "t2").lower(), "badge-t2"
            )
            lines.append(
                f'<div style="background: #1a1d2e; border-radius: 8px; padding: 12px 16px; '
                f'margin: 8px 0;">'
                f'<a href="{b["url"]}" style="color: #e8e8e8; text-decoration: none; font-weight: 600;">'
                f'{b["title"]}</a>'
                f'<span style="float: right;">'
                f'<span class="badge {tier_class}">{b.get("tier", "T2").upper()}</span>'
                f'<span class="reward" style="font-size: 14px; margin-left: 8px;">{b["reward"]}</span>'
                f'</span></div>'
            )

    if completed_bounties:
        lines.append(
            f'<h3 style="color: #34d399; margin: 20px 0 12px;">'
            f'✅ Completed Bounties ({len(completed_bounties)})</h3>'
        )
        for b in completed_bounties:
            lines.append(
                f'<div style="background: #1a1d2e; border-radius: 8px; padding: 12px 16px; '
                f'margin: 8px 0;">'
                f'<a href="{b["url"]}" style="color: #e8e8e8; text-decoration: none; font-weight: 600;">'
                f'{b["title"]}</a>'
                f'<span style="float: right; color: #34d399;">{b["reward"]}</span></div>'
            )

    bounty_list = "".join(lines) if lines else (
        '<p class="muted">No activity in the past period.</p>'
    )

    body = f"""
    <div class="card">
      <p>Hey {username},</p>
      <p>Here's your {digest_type} digest from SolFoundry!</p>
      {bounty_list}
      <p style="text-align: center; margin: 24px 0 0;">
        <a class="btn btn-primary" href="{bounties_url}">Browse All Bounties</a>
      </p>
    </div>
    """
    return _wrap(f"📊 {digest_type.title()} Digest", body)