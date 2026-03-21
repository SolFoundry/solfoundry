"""Email notification service for SolFoundry.

Sends branded HTML emails for bounty events via Resend.
Emails are queued asynchronously to avoid blocking API responses.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional
from email.utils import parseaddr

import resend
from pydantic import BaseModel, Field

from app.core.audit import audit_event
from app.models.notification import NotificationType

logger = logging.getLogger(__name__)

# Config
RESEND_API_KEY = "re_placeholder_key"  # Set via environment: RESEND_API_KEY
FROM_EMAIL = "SolFoundry <notifications@solfoundry.org>"

# Rate limiting: max 10 emails per user per hour
RATE_LIMIT_PER_USER = 10
RATE_LIMIT_WINDOW_SECS = 3600

_rate_limit_store: dict[str, list[float]] = {}


class EmailPayload(BaseModel):
    to_email: str
    subject: str = Field(max_length=200)
    html_body: str = Field(default="")
    notification_type: str
    user_id: str
    bounty_id: Optional[str] = None
    extra_data: Optional[dict] = None


class EmailTemplateContext(BaseModel):
    user_name: str = ""
    bounty_title: str = ""
    bounty_url: str = ""
    pr_url: str = ""
    payout_amount: str = ""
    ai_score: str = ""
    tx_hash: str = ""
    unsubscribe_url: str = ""


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

def _check_rate_limit(user_id: str) -> bool:
    import time
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW_SECS

    if user_id not in _rate_limit_store:
        _rate_limit_store[user_id] = []

    _rate_limit_store[user_id] = [
        ts for ts in _rate_limit_store[user_id] if ts > window_start
    ]

    if len(_rate_limit_store[user_id]) >= RATE_LIMIT_PER_USER:
        return False

    _rate_limit_store[user_id].append(now)
    return True


# ---------------------------------------------------------------------------
# Email templates (dark-themed HTML)
# ---------------------------------------------------------------------------

_PURPLE = "#9945FF"
_GREEN = "#14F195"
_DARK_BG = "#0a0a0a"
_DARK_CARD = "#111111"
_DARK_BORDER = "#1f1f1f"
_TEXT_PRIMARY = "#ffffff"
_TEXT_SECONDARY = "#9ca3af"
_TEXT_MUTED = "#6b7280"


_BASE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{subject}</title>
</head>
<body style="margin:0;padding:0;background-color:{dark_bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{dark_bg};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:0 0 32px 0;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:{text_primary};">
                <span style="color:{purple};">Sol</span><span style="color:{green};">Foundry</span> 🔥
              </span>
            </td>
          </tr>
          <tr>
            <td style="background-color:{card_bg};border:1px solid {border_color};border-radius:16px;padding:32px;">
              <tr><td style="padding:0 0 24px 0;text-align:center;"><span style="font-size:40px;">{icon}</span></td></tr>
              <tr><td style="padding:0 0 16px 0;text-align:center;">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:{text_primary};line-height:1.3;">{title}</h1>
              </td></tr>
              <tr><td style="padding:0 0 24px 0;">
                <p style="margin:0;font-size:16px;line-height:1.7;color:{text_secondary};">{body}</p>
              </td></tr>
              {cta_block}
              <tr><td style="padding:24px 0;"><hr style="border:none;border-top:1px solid {border_color};margin:0;"></td></tr>
              <tr>
                <td style="padding:0;text-align:center;">
                  <p style="margin:0 0 8px 0;font-size:13px;color:{text_muted};">You received this because notifications are enabled on SolFoundry.</p>
                  <p style="margin:0;font-size:13px;">
                    <a href="{unsubscribe_url}" style="color:{text_muted};text-decoration:underline;">Unsubscribe</a>
                    <span style="color:{text_muted};"> · </span>
                    <a href="https://solfoundry.org" style="color:{text_muted};text-decoration:underline;">solfoundry.org</a>
                  </p>
                </td>
              </tr>
            </td>
          </tr>
          <tr><td style="height:40px;"></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

_CTA_BUTTON = """<tr>
  <td style="padding:0 0 24px 0;text-align:center;">
    <a href="{url}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,{purple} 0%,{green} 100%);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:8px;">{label}</a>
  </td>
</tr>"""


def _build_email(subject, icon, title, body, cta_url="", cta_label="",
                 unsubscribe_url="https://solfoundry.org/settings/notifications"):
    cta_block = ""
    if cta_url and cta_label:
        cta_block = _CTA_BUTTON.format(url=cta_url, label=cta_label, purple=_PURPLE, green=_GREEN)

    html = _BASE_TEMPLATE.format(
        subject=subject, dark_bg=_DARK_BG, card_bg=_DARK_CARD,
        border_color=_DARK_BORDER, text_primary=_TEXT_PRIMARY,
        text_secondary=_TEXT_SECONDARY, text_muted=_TEXT_MUTED,
        purple=_PURPLE, green=_GREEN, icon=icon, title=title,
        body=body, cta_block=cta_block, unsubscribe_url=unsubscribe_url,
    )
    return subject, html


_TEMPLATES = {
    NotificationType.BOUNTY_CLAIMED.value: {
        "icon": "🎯",
        "title_template": "Bounty Claimed: {bounty_title}",
        "body_template": (
            "Great news! Your bounty <strong>\"{bounty_title}\"</strong> has been claimed by "
            "<strong>@{contributor}</strong>. They're ready to ship quality code for you!"
        ),
        "cta_label": "View Bounty",
    },
    NotificationType.SUBMISSION_RECEIVED.value: {
        "icon": "📬",
        "title_template": "New Submission: {bounty_title}",
        "body_template": (
            "<strong>@{contributor}</strong> just submitted a PR for your bounty "
            "<strong>\"{bounty_title}\"</strong>. Head over to review their work!"
        ),
        "cta_label": "Review Submission",
    },
    NotificationType.REVIEW_COMPLETE.value: {
        "icon": "✅",
        "title_template": "Review Complete — {bounty_title}",
        "body_template": (
            "Your submission for <strong>\"{bounty_title}\"</strong> has been reviewed. "
            "AI Score: <strong>{ai_score}/10</strong>. {status_text}"
        ),
        "cta_label": "View Feedback",
    },
    NotificationType.PAYOUT_CONFIRMED.value: {
        "icon": "💸",
        "title_template": "Payout Confirmed! {payout_amount} $FNDRY",
        "body_template": (
            "Your payout of <strong>{payout_amount} $FNDRY</strong> for "
            "<strong>\"{bounty_title}\"</strong> has been confirmed on-chain. "
            "Tx: <code>{tx_hash_short}</code>"
        ),
        "cta_label": "View on Explorer",
    },
    NotificationType.BOUNTY_EXPIRED.value: {
        "icon": "🔥",
        "title_template": "New Bounty Matches Your Skills!",
        "body_template": (
            "A new bounty <strong>\"{bounty_title}\"</strong> "
            "(Reward: <strong>{reward}</strong> $FNDRY) "
            "has been posted that matches your skills!"
        ),
        "cta_label": "View Bounty",
    },
}


def _render_template(notif_type: str, ctx: EmailTemplateContext, cta_url: str):
    tpl = _TEMPLATES.get(notif_type, {})
    icon = tpl.get("icon", "📬")
    title = tpl.get("title_template", "{bounty_title}").format(
        bounty_title=ctx.bounty_title or "Bounty", payout_amount=ctx.payout_amount or "")
    body_raw = tpl.get("body_template", "")
    cta_label = tpl.get("cta_label", "View")

    tx_short = (ctx.tx_hash[:16] + "...") if ctx.tx_hash else ""

    status_text = ""
    try:
        score_val = float(ctx.ai_score)
        if score_val >= 7:
            status_text = "🎉 Great work! Payout is on its way."
        elif score_val >= 5:
            status_text = "📋 Minor revisions may be requested."
        else:
            status_text = "📝 Check the review feedback for next steps."
    except (ValueError, TypeError):
        pass

    body = body_raw.format(
        bounty_title=ctx.bounty_title or "",
        contributor=ctx.user_name or "a contributor",
        ai_score=ctx.ai_score or "",
        status_text=status_text,
        payout_amount=ctx.payout_amount or "",
        tx_hash_short=tx_short,
        reward=ctx.payout_amount or "",
    )
    return _build_email(subject=title, icon=icon, title=title, body=body,
                        cta_url=cta_url, cta_label=cta_label,
                        unsubscribe_url=ctx.unsubscribe_url or "https://solfoundry.org/settings/notifications")


def _is_valid_email(email: str) -> bool:
    if not email or "@" not in email:
        return False
    domain = email.split("@", 1)[-1]
    return bool(domain) and "." in domain


async def send_email(payload: EmailPayload) -> bool:
    """Send email. Returns True on success, False on failure."""
    if not _check_rate_limit(payload.user_id):
        logger.warning(f"Rate limit exceeded for user {payload.user_id}")
        return False

    if not _is_valid_email(payload.to_email):
        logger.warning(f"Invalid email: {payload.to_email}")
        return False

    extra = payload.extra_data or {}
    ctx = EmailTemplateContext(
        user_name=extra.get("contributor", ""),
        bounty_title=extra.get("bounty_title", ""),
        bounty_url=f"https://solfoundry.org/bounties/{payload.bounty_id or ''}",
        pr_url=extra.get("pr_url", ""),
        tx_hash=extra.get("tx_hash", ""),
        payout_amount=str(extra.get("payout_amount", "")),
        ai_score=str(extra.get("ai_score", "")),
        unsubscribe_url=extra.get("unsubscribe_url", "https://solfoundry.org/settings/notifications"),
    )

    subject, html_body = _render_template(
        payload.notification_type, ctx,
        cta_url=extra.get("cta_url", "https://solfoundry.org"),
    )

    try:
        resend.api_key = RESEND_API_KEY
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": payload.to_email,
            "subject": subject,
            "html": html_body,
        })
        logger.info(f"Email sent to {payload.to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {payload.to_email}: {e}")
        audit_event("email_send_failed", user_id=payload.user_id, error=str(e),
                    notification_type=payload.notification_type)
        return False


# Async queue
_email_queue: asyncio.Queue = None
_loop = None


async def _worker_loop():
    global _loop
    _loop = asyncio.get_running_loop()
    while True:
        try:
            payload, future = await _email_queue.get()
            result = await send_email(payload)
            future.set_result(result)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Email worker error: {e}")


def start_worker():
    global _email_queue
    _email_queue = asyncio.Queue()
    asyncio.create_task(_worker_loop())


async def queue_email(payload: EmailPayload):
    if _loop is None:
        return False
    future = _loop.create_future()
    await _email_queue.put((payload, future))
    return await future


# Convenience wrappers
async def notify_bounty_claimed(to_email, user_id, bounty_id, bounty_title,
                                 contributor, unsubscribe_url):
    return await queue_email(EmailPayload(
        to_email=to_email, subject=f"Bounty Claimed: {bounty_title}",
        html_body="", notification_type=NotificationType.BOUNTY_CLAIMED.value,
        user_id=user_id, bounty_id=bounty_id,
        extra_data={"contributor": contributor, "unsubscribe_url": unsubscribe_url,
                    "cta_url": f"https://solfoundry.org/bounties/{bounty_id}",
                    "bounty_title": bounty_title},
    ))


async def notify_pr_submitted(to_email, user_id, bounty_id, bounty_title,
                               contributor, pr_url, unsubscribe_url):
    return await queue_email(EmailPayload(
        to_email=to_email, subject=f"New Submission: {bounty_title}",
        html_body="", notification_type=NotificationType.SUBMISSION_RECEIVED.value,
        user_id=user_id, bounty_id=bounty_id,
        extra_data={"contributor": contributor, "pr_url": pr_url,
                    "unsubscribe_url": unsubscribe_url, "cta_url": pr_url,
                    "bounty_title": bounty_title},
    ))


async def notify_review_complete(to_email, user_id, bounty_id, bounty_title,
                                  ai_score, unsubscribe_url):
    return await queue_email(EmailPayload(
        to_email=to_email, subject=f"Review Complete — {bounty_title}",
        html_body="", notification_type=NotificationType.REVIEW_COMPLETE.value,
        user_id=user_id, bounty_id=bounty_id,
        extra_data={"ai_score": ai_score, "unsubscribe_url": unsubscribe_url,
                    "cta_url": f"https://solfoundry.org/bounties/{bounty_id}",
                    "bounty_title": bounty_title},
    ))


async def notify_payout_sent(to_email, user_id, bounty_id, bounty_title,
                               amount, tx_hash, unsubscribe_url):
    return await queue_email(EmailPayload(
        to_email=to_email, subject=f"Payout Confirmed! {amount:,.0f} $FNDRY",
        html_body="", notification_type=NotificationType.PAYOUT_CONFIRMED.value,
        user_id=user_id, bounty_id=bounty_id,
        extra_data={"payout_amount": f"{amount:,.0f}", "tx_hash": tx_hash,
                    "unsubscribe_url": unsubscribe_url,
                    "cta_url": f"https://solfoundry.org/bounties/{bounty_id}",
                    "bounty_title": bounty_title},
    ))


async def notify_new_bounty(to_email, user_id, bounty_id, bounty_title,
                               reward, unsubscribe_url):
    return await queue_email(EmailPayload(
        to_email=to_email,
        subject=f"New Bounty Matches Your Skills! {reward:,.0f} $FNDRY",
        html_body="", notification_type=NotificationType.BOUNTY_EXPIRED.value,
        user_id=user_id, bounty_id=bounty_id,
        extra_data={"payout_amount": f"{reward:,.0f}",
                    "unsubscribe_url": unsubscribe_url,
                    "cta_url": f"https://solfoundry.org/bounties/{bounty_id}",
                    "bounty_title": bounty_title},
    ))
