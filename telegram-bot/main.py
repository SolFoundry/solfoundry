"""Entry point for the SolFoundry Telegram Bot."""
from bot.app import app_fastapi, run_polling, run_webhook
from bot.config import config

if __name__ == "__main__":
    import asyncio, sys

    errors = config.validate()
    if errors:
        for e in errors:
            print(f"CONFIG ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    mode = config.bot_mode.lower()
    if mode == "polling":
        asyncio.run(run_polling())
    elif mode == "webhook":
        import uvicorn
        uvicorn.run("bot.app:app", host="0.0.0.0", port=8080, reload=False)
    else:
        print(f"Unknown BOT_MODE: {mode}", file=sys.stderr)
        sys.exit(1)
