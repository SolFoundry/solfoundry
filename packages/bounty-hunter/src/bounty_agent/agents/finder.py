from __future__ import annotations

from dataclasses import dataclass

from bounty_agent.agents.base import AgentContext, BaseAgent
from bounty_agent.models import AgentRole, Bounty, DiscoveryCriteria


DIFFICULTY_ORDER = {"low": 1, "medium": 2, "high": 3, "expert": 4}


@dataclass(slots=True)
class FinderAgent(BaseAgent):
    def __init__(self) -> None:
        super().__init__(role=AgentRole.FINDER, name="Bounty Finder")

    def discover(
        self,
        marketplace: list[Bounty],
        criteria: DiscoveryCriteria,
        context: AgentContext,
    ) -> list[Bounty]:
        discovered = []
        for bounty in marketplace:
            if bounty.reward_usd < criteria.min_reward_usd:
                continue
            if criteria.preferred_languages and not (
                set(bounty.languages) & set(criteria.preferred_languages)
            ):
                continue
            if set(criteria.excluded_tags) & set(bounty.tags):
                continue
            if criteria.max_difficulty:
                if DIFFICULTY_ORDER[bounty.difficulty] > DIFFICULTY_ORDER[criteria.max_difficulty]:
                    continue
            discovered.append(bounty)

        context.send_message(
            self.message(
                AgentRole.MASTER,
                "discovery_complete",
                f"Discovered {len(discovered)} candidate bounties after filtering.",
                discovered_ids=[b.id for b in discovered],
            )
        )
        return discovered
