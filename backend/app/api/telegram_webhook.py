"""Telegram bot webhook for admin dispute resolution.

Handles:
  - Inline keyboard callback queries (resolve:dispute_id:outcome[:split_pct])
  - /resolve command messages
"""

import logging
import os

from fastapi import APIRouter, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.dispute import DisputeResolve
from app.services.dispute_service import DisputeService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks/telegram", tags=["telegram"])

TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
TELEGRAM_ADMIN_CHAT_ID = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
SYSTEM_ADMIN_ID = os.getenv("SYSTEM_ADMIN_ID", "00000000-0000-0000-0000-000000000000")


def _parse_callback(data: str) -> dict | None:
    """Parse callback_data like 'resolve:uuid:contributor' or 'resolve:uuid:split:60'."""
    parts = data.split(":")
    if len(parts) < 3 or parts[0] != "resolve":
        return None

    result = {"dispute_id": parts[1], "outcome": parts[2]}

    outcome_map = {
        "contributor": "release_to_contributor",
        "creator": "refund_to_creator",
        "split": "split",
    }
    result["outcome"] = outcome_map.get(parts[2], parts[2])

    if result["outcome"] == "split" and len(parts) >= 4:
        try:
            result["split_pct"] = float(parts[3])
        except ValueError:
            result["split_pct"] = 50.0
    elif result["outcome"] == "split":
        result["split_pct"] = 50.0

    return result


def _parse_resolve_command(text: str) -> dict | None:
    """Parse '/resolve <dispute_id> <outcome> [split_pct]'."""
    parts = text.strip().split()
    if len(parts) < 3 or parts[0] != "/resolve":
        return None

    outcome_map = {
        "contributor": "release_to_contributor",
        "creator": "refund_to_creator",
        "split": "split",
    }

    result = {
        "dispute_id": parts[1],
        "outcome": outcome_map.get(parts[2], parts[2]),
    }

    if result["outcome"] == "split":
        if len(parts) >= 4:
            try:
                result["split_pct"] = float(parts[3])
            except ValueError:
                result["split_pct"] = 50.0
        else:
            result["split_pct"] = 50.0

    return result


async def _resolve_from_telegram(parsed: dict) -> str:
    """Execute a dispute resolution from Telegram input."""
    resolve_data = DisputeResolve(
        outcome=parsed["outcome"],
        resolution_notes="Resolved via Telegram admin action",
        split_contributor_pct=parsed.get("split_pct"),
    )

    async with get_db_session() as db:
        svc = DisputeService(db)
        try:
            result = await svc.resolve_dispute(
                parsed["dispute_id"], resolve_data, SYSTEM_ADMIN_ID
            )
            return (
                f"Dispute {parsed['dispute_id'][:8]}... resolved.\n"
                f"Outcome: {result.outcome}\n"
                f"State: {result.state}"
            )
        except ValueError as e:
            return f"Failed: {e}"
        except Exception as e:
            logger.error("Telegram resolve failed: %s", e)
            return f"Error: {e}"


@router.post("")
async def telegram_webhook(request: Request):
    """
    Receives Telegram bot updates (callback queries and messages).

    Set this URL as your bot webhook via:
      https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_DOMAIN>/api/webhooks/telegram
    """
    body = await request.json()

    if TELEGRAM_WEBHOOK_SECRET:
        secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if secret != TELEGRAM_WEBHOOK_SECRET:
            raise HTTPException(status_code=403, detail="Invalid webhook secret")

    if "callback_query" in body:
        callback = body["callback_query"]
        chat_id = callback.get("message", {}).get("chat", {}).get("id")

        if TELEGRAM_ADMIN_CHAT_ID and str(chat_id) != TELEGRAM_ADMIN_CHAT_ID:
            return {"ok": True}

        parsed = _parse_callback(callback.get("data", ""))
        if parsed:
            reply = await _resolve_from_telegram(parsed)
            return {"method": "answerCallbackQuery", "callback_query_id": callback["id"], "text": reply}

    if "message" in body:
        message = body["message"]
        chat_id = message.get("chat", {}).get("id")
        text = message.get("text", "")

        if TELEGRAM_ADMIN_CHAT_ID and str(chat_id) != TELEGRAM_ADMIN_CHAT_ID:
            return {"ok": True}

        if text.startswith("/resolve"):
            parsed = _parse_resolve_command(text)
            if parsed:
                reply = await _resolve_from_telegram(parsed)
                return {
                    "method": "sendMessage",
                    "chat_id": chat_id,
                    "text": reply,
                }

    return {"ok": True}
