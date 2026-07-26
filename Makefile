# SolFoundry Makefile — common convenience targets.

# ---------------------------------------------------------------------------
# Discord bounty bot
# ---------------------------------------------------------------------------
.PHONY: poll poll-once discord-bot-test

poll: ## Run the Discord bounty notification daemon (env vars required)
	python -m automaton.discord_bot

poll-once: ## Poll once and exit (useful for cron / dry-runs)
	python -m automaton.discord_bot --poll-once

discord-bot-test: ## Run unit tests for the Discord bot
	python -m pytest tests/test_discord_bot.py -v
