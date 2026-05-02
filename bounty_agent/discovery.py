"""Bounty discovery module — multi-platform scanner with SolFoundry API integration.

Supports:
- SolFoundry platform API (primary)
- GitHub Issues/Labels search
- RustChain bounties
- Immunefi bug bounties
- Code4rena audit contests

Each adapter implements the BountyAdapter interface, making it easy to add
new platforms without modifying the core scanner.
"""

import re
import json
import subprocess
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum

logger = logging.getLogger("bounty_agent.discovery")


class BountyTier(Enum):
    T1_CRITICAL = "T1"
    T2_MAJOR = "T2"
    T3_STANDARD = "T3"
    UNKNOWN = "unknown"


class BountyStatus(Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


@dataclass
class BountyIssue:
    platform: str
    repo: str
    issue_number: int
    title: str
    reward: str
    tier: BountyTier = BountyTier.UNKNOWN
    status: BountyStatus = BountyStatus.OPEN
    labels: List[str] = field(default_factory=list)
    url: str = ""
    difficulty: str = "unknown"
    description: str = ""
    deadline: Optional[str] = None
    skills_required: List[str] = field(default_factory=list)
    skill_match_score: float = 0.0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    assignee: Optional[str] = None
    existing_prs: int = 0

    @property
    def is_easy(self) -> bool:
        return (
            "easy" in self.labels
            or "good first issue" in self.labels
            or self.tier == BountyTier.T3_STANDARD
        )

    @property
    def is_critical(self) -> bool:
        return (
            self.tier == BountyTier.T1_CRITICAL
            or "critical" in self.labels
            or "red-team" in self.labels
        )

    @property
    def reward_amount(self) -> float:
        match = re.search(r"([\d,]+)", self.reward)
        if match:
            return float(match.group(1).replace(",", ""))
        return 0.0

    @property
    def competition_level(self) -> str:
        if self.existing_prs == 0:
            return "low"
        if self.existing_prs <= 2:
            return "medium"
        if self.existing_prs <= 5:
            return "high"
        return "very_high"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "platform": self.platform,
            "repo": self.repo,
            "issue_number": self.issue_number,
            "title": self.title,
            "reward": self.reward,
            "tier": self.tier.value,
            "status": self.status.value,
            "labels": self.labels,
            "url": self.url,
            "difficulty": self.difficulty,
            "skill_match_score": self.skill_match_score,
            "existing_prs": self.existing_prs,
            "competition_level": self.competition_level,
        }


class BountyAdapter(ABC):
    @property
    @abstractmethod
    def platform_name(self) -> str: ...

    @abstractmethod
    def scan(self, config: Dict[str, Any]) -> List[BountyIssue]: ...

    @abstractmethod
    def get_bounty_detail(self, bounty_id: str, config: Dict[str, Any]) -> Optional[BountyIssue]: ...


class SolFoundryAdapter(BountyAdapter):
    API_BASE = "https://api.solfoundry.io/v1"

    @property
    def platform_name(self) -> str:
        return "SolFoundry"

    def scan(self, config: Dict[str, Any]) -> List[BountyIssue]:
        min_reward = config.get("min_reward", 0)
        target_tiers = config.get("target_tiers", ["T2", "T3"])
        try:
            bounties = self._scan_via_github(config)
        except Exception as exc:
            logger.warning("SolFoundry scan failed: %s", exc)
            bounties = []
        filtered = [b for b in bounties if b.tier.value in target_tiers and b.reward_amount >= min_reward]
        logger.info("SolFoundry scan: %d total, %d after filters", len(bounties), len(filtered))
        return filtered

    def get_bounty_detail(self, bounty_id: str, config: Dict[str, Any]) -> Optional[BountyIssue]:
        repo = config.get("solfoundry_repo", "SolFoundry/solfoundry")
        try:
            cmd = ["gh", "issue", "view", bounty_id, f"--repo={repo}", "--json", "title,body,labels,url"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                return None
            data = json.loads(result.stdout)
            labels = [l.get("name", "") for l in data.get("labels", [])]
            return BountyIssue(
                platform=self.platform_name, repo=repo,
                issue_number=int(bounty_id), title=data.get("title", ""),
                reward=self._extract_reward(data.get("title", "")),
                tier=self._infer_tier(labels, data.get("title", "")),
                labels=labels, url=data.get("url", ""),
                description=data.get("body", "")[:500],
            )
        except Exception as exc:
            logger.error("Detail fetch failed: %s", exc)
            return None

    def _scan_via_github(self, config: Dict[str, Any]) -> List[BountyIssue]:
        repo = config.get("solfoundry_repo", "SolFoundry/solfoundry")
        limit = config.get("scan_limit", 30)
        cmd = ["gh", "issue", "list", f"--repo={repo}", "--state=open", f"--limit={limit}",
               "--json", "number,title,labels,url,updatedAt", "--search", "bounty"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return []
        items = json.loads(result.stdout)
        bounties = []
        for item in items:
            labels = [l.get("name", "") for l in item.get("labels", [])]
            tier = self._infer_tier(labels, item.get("title", ""))
            bounties.append(BountyIssue(
                platform=self.platform_name, repo=repo,
                issue_number=item.get("number", 0), title=item.get("title", ""),
                reward=self._extract_reward(item.get("title", "")),
                tier=tier, labels=labels, url=item.get("url", ""),
                difficulty=self._tier_to_difficulty(tier),
                updated_at=item.get("updatedAt"),
            ))
        return bounties

    @staticmethod
    def _infer_tier(labels: List[str], title: str) -> BountyTier:
        label_set = {l.lower() for l in labels}
        if "t1" in label_set or "critical" in label_set:
            return BountyTier.T1_CRITICAL
        if "t2" in label_set or "major" in label_set:
            return BountyTier.T2_MAJOR
        if "t3" in label_set or "standard" in label_set:
            return BountyTier.T3_STANDARD
        title_lower = title.lower()
        if "critical" in title_lower or "red team" in title_lower:
            return BountyTier.T1_CRITICAL
        if "major" in title_lower:
            return BountyTier.T2_MAJOR
        return BountyTier.T3_STANDARD

    @staticmethod
    def _extract_reward(title: str) -> str:
        patterns = [r"(\d[\d,]*)\s*\$FNDRY", r"(\d[\d,]*)\s*FNDRY", r"(\d[\d,]*)\s*RTC",
                    r"(\d[\d,]*)\s*USDC", r"(\d[\d,]*)\s*SOL", r"\$\s*(\d[\d,]*)"]
        for pat in patterns:
            match = re.search(pat, title, re.IGNORECASE)
            if match:
                token = re.search(r"(FNDRY|RTC|USDC|SOL)", title, re.IGNORECASE)
                token_str = token.group(1).upper() if token else "USD"
                return f"{match.group(1)} {token_str}"
        return "unknown"

    @staticmethod
    def _tier_to_difficulty(tier: BountyTier) -> str:
        return {BountyTier.T1_CRITICAL: "hard", BountyTier.T2_MAJOR: "medium", BountyTier.T3_STANDARD: "easy"}.get(tier, "medium")


class GitHubAdapter(BountyAdapter):
    @property
    def platform_name(self) -> str:
        return "GitHub"

    def scan(self, config: Dict[str, Any]) -> List[BountyIssue]:
        keywords = config.get("github_keywords", "bounty")
        limit = config.get("scan_limit", 20)
        cmd = ["gh", "search", "issues", keywords, "--label=bounty", f"--limit={limit}",
               "--sort=updated", "--json", "repository,title,number,labels,url,updatedAt"]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                return []
            items = json.loads(result.stdout)
            bounties = []
            for item in items:
                repo = item.get("repository", {}).get("nameWithOwner", "")
                labels = [e.get("name", "") for e in item.get("labels", [])]
                bounties.append(BountyIssue(
                    platform=self.platform_name, repo=repo,
                    issue_number=item.get("number", 0), title=item.get("title", ""),
                    reward=self._extract_reward(item.get("title", "")),
                    labels=labels, url=item.get("url", ""),
                    difficulty=self._assess_difficulty(labels),
                    updated_at=item.get("updatedAt"),
                ))
            return bounties
        except Exception as exc:
            logger.error("GitHub scan failed: %s", exc)
            return []

    def get_bounty_detail(self, bounty_id: str, config: Dict[str, Any]) -> Optional[BountyIssue]:
        repo = config.get("github_repo", "")
        if not repo:
            return None
        try:
            cmd = ["gh", "issue", "view", bounty_id, f"--repo={repo}", "--json", "title,body,labels,url"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                return None
            data = json.loads(result.stdout)
            labels = [l.get("name", "") for l in data.get("labels", [])]
            return BountyIssue(
                platform=self.platform_name, repo=repo,
                issue_number=int(bounty_id), title=data.get("title", ""),
                reward=self._extract_reward(data.get("title", "")),
                labels=labels, url=data.get("url", ""),
                description=data.get("body", "")[:500],
            )
        except Exception as exc:
            logger.error("GitHub detail failed: %s", exc)
            return None

    @staticmethod
    def _extract_reward(title: str) -> str:
        match = re.search(r"(\d+)\s*(RTC|\$FNDRY|USDC|SOL|USD)", title, re.IGNORECASE)
        return f"{match.group(1)} {match.group(2)}" if match else "unknown"

    @staticmethod
    def _assess_difficulty(labels: List[str]) -> str:
        if "easy" in labels or "good first issue" in labels:
            return "easy"
        if "hard" in labels or "red-team" in labels:
            return "hard"
        return "medium"


class RustChainAdapter(BountyAdapter):
    GITHUB_ORG = "rustchain-ecosystem"

    @property
    def platform_name(self) -> str:
        return "RustChain"

    def scan(self, config: Dict[str, Any]) -> List[BountyIssue]:
        min_reward = config.get("rustchain_min_reward", 1)
        repos = config.get("rustchain_repos", [
            f"{self.GITHUB_ORG}/rustchain", f"{self.GITHUB_ORG}/wallet-ppc",
            f"{self.GITHUB_ORG}/living-museum",
        ])
        all_bounties = []
        for repo in repos:
            all_bounties.extend(self._scan_repo(repo, config.get("scan_limit", 20)))
        return [b for b in all_bounties if self._parse_rtc_reward(b.reward) >= min_reward]

    def get_bounty_detail(self, bounty_id: str, config: Dict[str, Any]) -> Optional[BountyIssue]:
        repo = config.get("rustchain_repo", f"{self.GITHUB_ORG}/rustchain")
        try:
            cmd = ["gh", "issue", "view", bounty_id, f"--repo={repo}", "--json", "title,body,labels,url"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                return None
            data = json.loads(result.stdout)
            labels = [l.get("name", "") for l in data.get("labels", [])]
            return BountyIssue(
                platform=self.platform_name, repo=repo,
                issue_number=int(bounty_id), title=data.get("title", ""),
                reward=self._extract_rtc_reward(data.get("title", "")),
                labels=labels, url=data.get("url", ""),
                description=data.get("body", "")[:500],
            )
        except Exception:
            return None

    def _scan_repo(self, repo: str, limit: int) -> List[BountyIssue]:
        try:
            cmd = ["gh", "issue", "list", f"--repo={repo}", "--state=open", f"--limit={limit}",
                   "--json", "number,title,labels,url,updatedAt", "--search", "bounty OR RTC"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                return []
            items = json.loads(result.stdout)
            return [BountyIssue(
                platform=self.platform_name, repo=repo,
                issue_number=i.get("number", 0), title=i.get("title", ""),
                reward=self._extract_rtc_reward(i.get("title", "")),
                tier=self._infer_rtc_tier(i.get("title", "")),
                labels=[l.get("name", "") for l in i.get("labels", [])],
                url=i.get("url", ""), updated_at=i.get("updatedAt"),
            ) for i in items]
        except Exception:
            return []

    @staticmethod
    def _extract_rtc_reward(title: str) -> str:
        match = re.search(r"(\d+)\s*RTC", title, re.IGNORECASE)
        return f"{match.group(1)} RTC" if match else "unknown"

    @staticmethod
    def _parse_rtc_reward(reward: str) -> float:
        match = re.search(r"(\d+)", reward)
        return float(match.group(1)) if match else 0.0

    @staticmethod
    def _infer_rtc_tier(title: str) -> BountyTier:
        match = re.search(r"(\d+)\s*RTC", title, re.IGNORECASE)
        if match and int(match.group(1)) >= 50:
            return BountyTier.T1_CRITICAL
        if match and int(match.group(1)) >= 10:
            return BountyTier.T2_MAJOR
        return BountyTier.T3_STANDARD


class ImmunefiAdapter(BountyAdapter):
    @property
    def platform_name(self) -> str:
        return "Immunefi"

    def scan(self, config: Dict[str, Any]) -> List[BountyIssue]:
        bounties = []
        try:
            cmd = ["gh", "search", "issues", "immunefi bounty", "--limit=10",
                   "--sort=updated", "--json", "repository,title,number,labels,url"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                for item in json.loads(result.stdout):
                    labels = [l.get("name", "") for l in item.get("labels", [])]
                    bounties.append(BountyIssue(
                        platform=self.platform_name,
                        repo=item.get("repository", {}).get("nameWithOwner", ""),
                        issue_number=item.get("number", 0), title=item.get("title", ""),
                        reward="unknown", tier=BountyTier.T1_CRITICAL,
                        labels=labels, url=item.get("url", ""), difficulty="hard",
                    ))
        except Exception as exc:
            logger.warning("Immunefi scan failed: %s", exc)
        return bounties

    def get_bounty_detail(self, bounty_id: str, config: Dict[str, Any]) -> Optional[BountyIssue]:
        return None


class BountyScanner:
    """Multi-platform bounty scanner with adapter-based architecture."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self._adapters: Dict[str, BountyAdapter] = {}
        self._register_default_adapters()

    def _register_default_adapters(self):
        self._adapters["solfoundry"] = SolFoundryAdapter()
        self._adapters["github"] = GitHubAdapter()
        self._adapters["rustchain"] = RustChainAdapter()
        self._adapters["immunefi"] = ImmunefiAdapter()

    def register_adapter(self, name: str, adapter: BountyAdapter):
        self._adapters[name] = adapter

    def scan_all(self, platforms: Optional[List[str]] = None) -> List[BountyIssue]:
        targets = platforms or list(self._adapters.keys())
        all_bounties: List[BountyIssue] = []
        seen_urls: set = set()
        for key in targets:
            adapter = self._adapters.get(key)
            if not adapter:
                continue
            try:
                for b in adapter.scan(self.config):
                    if b.url not in seen_urls:
                        seen_urls.add(b.url)
                        all_bounties.append(b)
            except Exception as exc:
                logger.error("Adapter %s failed: %s", key, exc)
        return all_bounties

    def scan_platform(self, platform: str) -> List[BountyIssue]:
        return self.scan_all(platforms=[platform])

    def get_bounty_detail(self, bounty_id: str, platform: str = "solfoundry") -> Optional[BountyIssue]:
        adapter = self._adapters.get(platform)
        return adapter.get_bounty_detail(bounty_id, self.config) if adapter else None

    def prioritize(self, bounties: List[BountyIssue], top_n: int = 10, strategy: str = "balanced") -> List[BountyIssue]:
        if strategy == "easy_first":
            return sorted(bounties, key=lambda b: (0 if b.is_easy else (2 if b.difficulty == "hard" else 1), -b.reward_amount))[:top_n]
        if strategy == "high_reward":
            return sorted(bounties, key=lambda b: -b.reward_amount)[:top_n]
        if strategy == "low_competition":
            return sorted(bounties, key=lambda b: b.existing_prs)[:top_n]
        scored = []
        for b in bounties:
            reward_score = min(b.reward_amount / 100, 40)
            comp_score = max(30 - b.existing_prs * 6, 0)
            diff_score = {BountyTier.T3_STANDARD: 20, BountyTier.T2_MAJOR: 15, BountyTier.T1_CRITICAL: 8}.get(b.tier, 10)
            total = reward_score + comp_score + diff_score + b.skill_match_score * 10
            scored.append((total, b))
        scored.sort(key=lambda x: -x[0])
        return [b for _, b in scored[:top_n]]

    def analyze_competition(self, bounty: BountyIssue) -> Dict[str, Any]:
        return {"bounty_id": bounty.issue_number, "platform": bounty.platform,
                "existing_prs": bounty.existing_prs, "competition_level": bounty.competition_level,
                "strategy": self._competition_strategy(bounty)}

    @staticmethod
    def _competition_strategy(bounty: BountyIssue) -> str:
        levels = {"low": "First-mover: submit early with solid tests",
                  "medium": "Differentiate: add unique features",
                  "high": "Quality over speed: comprehensive tests and unique value",
                  "very_high": "Niche play: find angle competitors missed"}
        return levels.get(bounty.competition_level, "Standard approach")
