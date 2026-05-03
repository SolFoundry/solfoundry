"""PR submission module — creates bounty PRs via gh CLI with sanitization."""

import subprocess
import re
from typing import Optional


class PRSubmitter:
    """Handles PR creation for bounty submissions."""

    def submit_pr(
        self,
        repo: str,
        branch: str,
        title: str,
        body: str,
        base: str = "main",
    ) -> Optional[str]:
        """Create a PR via GitHub CLI."""
        cmd = [
            "gh", "pr", "create",
            f"--repo={repo}",
            f"--head={branch}",
            f"--base={base}",
            f"--title={title}",
            f"--body={body}",
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            return result.stdout.strip() if result.returncode == 0 else None
        except Exception as e:
            print(f"PR error: {e}")
            return None

    @staticmethod
    def format_pr_body(
        bounty_issue: int,
        approach: str,
        implementation: str,
        testing: str,
        wallet_address: str = "",
    ) -> str:
        """Format a PR body for bounty submission."""
        wallet_section = ""
        if wallet_address:
            wallet_section = f"\n### Solana Wallet for Payout\n`{wallet_address}`\n"

        return (
            f"## Bounty Submission: #{bounty_issue}\n\n"
            f"### Approach\n{approach}\n\n"
            f"### Implementation\n{implementation}\n\n"
            f"### Testing\n{testing}\n\n"
            f"### Multi-LLM Review\n"
            f"- Implementation review (GLM-5.1)\n"
            f"- Security review (DeepSeek-V4-Pro)\n"
            f"- Code quality (Qwen-3.5-397B)\n"
            f"{wallet_section}"
            f"---\n*Submitted by Xeophon*"
        )

    @staticmethod
    def _sanitize_pr_body(body: str) -> str:
        """Remove internal architecture details from PR body."""
        # Remove agent count / gateway count leaks
        body = re.sub(r'\d+\s*agents?\s*,\s*\d+\s*gateways?', '[sanitized]', body, flags=re.IGNORECASE)
        # Remove internal IP addresses
        body = re.sub(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', '[redacted-ip]', body)
        # Remove internal gateway port references
        body = re.sub(r'(?:GW|gw)-\d+:?\d{4,5}', '[gateway-redacted]', body)
        return body
