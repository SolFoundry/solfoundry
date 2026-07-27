#!/usr/bin/env python3
"""SolFoundry Post Bounty GitHub Action entrypoint.

Converts labeled GitHub issues into SolFoundry bounties.
Triggered by `issues: [opened, labeled]` events.
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error


def get_input(name: str) -> str:
    """Get an action input from environment variable."""
    env_var = f"INPUT_{name.upper().replace('-', '_')}"
    return os.environ.get(env_var, "")


def get_github_context() -> dict:
    """Parse the GitHub event payload from GITHUB_EVENT_PATH."""
    event_path = os.environ.get("GITHUB_EVENT_PATH", "")
    if not event_path or not os.path.exists(event_path):
        print("::warning::GITHUB_EVENT_PATH not set or file not found", file=sys.stderr)
        return {}

    with open(event_path, "r") as f:
        return json.load(f)


def extract_reward(labels: list[dict], pattern: str, default: str) -> int:
    """Extract reward amount from issue labels using regex pattern."""
    for label in labels:
        name = label.get("name", "")
        match = re.search(pattern, name, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except (ValueError, IndexError):
                pass
    return int(default)


def estimate_tier(labels: list[dict], default_tier: int) -> int:
    """Estimate bounty tier based on issue labels."""
    label_names = [l.get("name", "").lower() for l in labels]
    if any("tier-3" in ln or "t3" in ln for ln in label_names):
        return 3
    if any("tier-2" in ln or "t2" in ln for ln in label_names):
        return 2
    if any("tier-1" in ln or "t1" in ln for ln in label_names):
        return 1
    return default_tier


def post_bounty_to_solfoundry(
    api_url: str,
    api_token: str,
    bounty_data: dict,
) -> dict:
    """Post a bounty to the SolFoundry API."""
    url = f"{api_url.rstrip('/')}/api/bounties"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "SolFoundry-Action/1.0",
    }
    if api_token:
        headers["Authorization"] = f"Bearer {api_token}"

    data = json.dumps(bounty_data).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else str(e)
        raise Exception(f"SolFoundry API error {e.code}: {error_body}")
    except urllib.error.URLError as e:
        raise Exception(f"SolFoundry API unreachable: {e.reason}")


def comment_on_issue(
    github_token: str,
    repo: str,
    issue_number: int,
    message: str,
) -> bool:
    """Post a comment on a GitHub issue."""
    url = f"https://api.github.com/repos/{repo}/issues/{issue_number}/comments"
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "SolFoundry-Action/1.0",
    }
    data = json.dumps({"body": message}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status == 201
    except Exception:
        return False


def main():
    """Main entrypoint for the GitHub Action."""
    # Read inputs
    api_url = get_input("solfoundry-api-url")
    api_token = get_input("solfoundry-api-token")
    github_token = get_input("github-token")
    default_reward = get_input("default-reward")
    reward_pattern = get_input("reward-label-pattern")
    default_tier = int(get_input("tier"))
    trigger_labels = [l.strip() for l in get_input("labels").split(",") if l.strip()]

    # Read GitHub event context
    event = get_github_context()
    if not event:
        print("::error::Failed to read GitHub event context")
        sys.exit(1)

    # Check event type
    if "issue" not in event:
        print("::warning::Event does not contain an issue. Skipping.")
        return

    issue = event["issue"]
    repository = event.get("repository", {})
    repo_full_name = repository.get("full_name", "unknown/repo")
    issue_number = issue.get("number", 0)
    issue_title = issue.get("title", "Untitled")
    issue_body = issue.get("body", "")
    issue_url = issue.get("html_url", "")
    issue_labels = issue.get("labels", [])
    action = event.get("action", "")

    print(f"🔍 Processing issue #{issue_number}: {issue_title}")
    print(f"📦 Repository: {repo_full_name}")
    print(f"🏷️  Action: {action}")

    # Check if issue has a trigger label
    issue_label_names = [l.get("name", "").lower() for l in issue_labels]
    has_trigger = any(tl.lower() in issue_label_names for tl in trigger_labels)

    if not has_trigger:
        print(f"⏭️  Issue does not have trigger labels ({trigger_labels}). Skipping.")
        return

    # Check if issue is already assigned as a bounty
    # Look for existing comment from this action
    print(f"✅ Issue has trigger labels. Proceeding to post...")

    # Extract reward
    reward = extract_reward(issue_labels, reward_pattern, default_reward)
    print(f"💰 Reward: {reward} $FNDRY")

    # Estimate tier
    tier = estimate_tier(issue_labels, default_tier)
    print(f"🏆 Tier: {tier}")

    # Build description
    description_lines = [
        f"## Source: {issue_url}",
        "",
        f"**Issue #{issue_number}** from repository `{repo_full_name}`",
        "",
        "---",
        "",
    ]
    if issue_body:
        description_lines.append(issue_body)
    else:
        description_lines.append("No description provided.")
    description_lines.extend([
        "",
        "---",
        f"*Auto-imported from {repo_full_name} issue #{issue_number}*",
        f"*Labels: {', '.join(l.get('name', '') for l in issue_labels)}*",
    ])
    description = "\n".join(description_lines)

    # Build bounty payload
    bounty = {
        "title": issue_title,
        "description": description,
        "source_url": issue_url,
        "source_issue_number": issue_number,
        "source_repo": repo_full_name,
        "reward_amount": float(reward),
        "tier": tier,
        "tags": [l.get("name", "") for l in issue_labels],
    }

    # Post to SolFoundry
    try:
        print(f"📤 Posting bounty to SolFoundry...")
        result = post_bounty_to_solfoundry(api_url, api_token, bounty)
        bounty_id = result.get("id", result.get("_id", "unknown"))
        bounty_url = result.get("url", f"{api_url.rstrip('/')}/bounties/{bounty_id}")
        print(f"✅ Bounty posted successfully!")
        print(f"   ID: {bounty_id}")
        print(f"   URL: {bounty_url}")

        # Comment on the issue
        comment = (
            f"## ✅ Bounty Posted to SolFoundry!\n\n"
            f"This issue has been automatically posted as a bounty on SolFoundry.\n\n"
            f"| Field | Value |\n"
            f"|-------|-------|\n"
            f"| **Bounty ID** | `{bounty_id}` |\n"
            f"| **Reward** | {reward} $FNDRY |\n"
            f"| **Tier** | T{tier} |\n"
            f"| **Status** | Open |\n\n"
            f"🔗 [View on SolFoundry]({bounty_url})\n"
        )
        comment_on_issue(github_token, repo_full_name, issue_number, comment)
        print(f"💬 Comment posted on issue #{issue_number}")

        # Set output
        github_output = os.environ.get("GITHUB_OUTPUT", "")
        if github_output:
            with open(github_output, "a") as f:
                f.write(f"bounty_id={bounty_id}\n")
                f.write(f"bounty_url={bounty_url}\n")

        # Set summary
        github_step_summary = os.environ.get("GITHUB_STEP_SUMMARY", "")
        if github_step_summary:
            with open(github_step_summary, "w") as f:
                f.write(
                    f"## SolFoundry Bounty Posted\n\n"
                    f"- **Issue:** [#{issue_number}]({issue_url}) - {issue_title}\n"
                    f"- **Bounty ID:** {bounty_id}\n"
                    f"- **Reward:** {reward} $FNDRY\n"
                    f"- **Tier:** T{tier}\n"
                    f"- **[View on SolFoundry]({bounty_url})**\n"
                )

    except Exception as e:
        print(f"::error::Failed to post bounty: {e}")
        # Comment error on issue
        comment_on_issue(
            github_token,
            repo_full_name,
            issue_number,
            f"## ❌ Failed to Post Bounty\n\n"
            f"Could not post this issue as a bounty on SolFoundry.\n\n"
            f"**Error:** {e}\n\n"
            f"Please check your SolFoundry API token and try again, or post manually.",
        )
        sys.exit(1)


if __name__ == "__main__":
    main()