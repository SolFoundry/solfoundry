#!/usr/bin/env python3
"""
SolFoundry GitHub Action: Post labeled issues as bounties.

Detects GitHub issues labeled with bounty-related labels and
automatically posts them to the SolFoundry marketplace with
configurable reward tiers.

Usage (via GitHub Actions):
    - name: Post Bounty
      uses: SolFoundry/solfoundry/.github/actions/post-bounty@main
      with:
        solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
        reward-tier-1: '50000'
        reward-tier-2: '500000'
        reward-tier-3: '5000000'
        bounty-labels: 'bounty-t1,bounty-t2,bounty-t3'
"""

import json
import os
import sys
import urllib.request
import urllib.error


def load_event() -> dict:
    """Load the GitHub event payload from GITHUB_EVENT_PATH."""
    path = os.environ.get("GITHUB_EVENT_PATH")
    if not path:
        print("::error::GITHUB_EVENT_PATH not set — not running in a GitHub Action context")
        sys.exit(1)
    with open(path) as f:
        return json.load(f)


def get_input(name: str, default: str = "") -> str:
    """Read a GitHub Action input using the INPUT_<NAME> convention."""
    env_name = f"INPUT_{name.upper().replace('-', '_')}"
    return os.environ.get(env_name, default)


def call_solfoundry_api(api_key: str, payload: dict) -> dict:
    """Call the SolFoundry API to create a bounty."""
    url = "https://api.solfoundry.dev/api/bounties"  # production API
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "solfoundry-github-action/1.0",
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            result = json.loads(body)
            print(f"::notice::Bounty created successfully — ID: {result.get('id', 'unknown')}")
            return result
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"::error::SolFoundry API error (HTTP {e.code}): {err_body}")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"::error::Network error calling SolFoundry API: {e.reason}")
        sys.exit(1)


def main():
    event = load_event()
    event_name = os.environ.get("GITHUB_EVENT_NAME", "")

    # --- Read inputs ---
    api_key = get_input("solfoundry-api-key")
    if not api_key:
        print("::error::solfoundry-api-key is required")
        sys.exit(1)

    tier_labels_raw = get_input("bounty-labels", "bounty-t1,bounty-t2,bounty-t3")
    tier_labels = [t.strip() for t in tier_labels_raw.split(",") if t.strip()]

    # Reward mapping: label -> reward amount ($FNDRY)
    reward_t1 = int(get_input("reward-tier-1", "50000"))
    reward_t2 = int(get_input("reward-tier-2", "500000"))
    reward_t3 = int(get_input("reward-tier-3", "5000000"))

    # Label-to-tier mapping
    label_tier_map = {}
    for i, label in enumerate(tier_labels):
        tier_num = i + 1
        if tier_num == 1:
            label_tier_map[label] = (1, reward_t1)
        elif tier_num == 2:
            label_tier_map[label] = (2, reward_t2)
        else:
            label_tier_map[label] = (3, reward_t3)

    # --- Detect bounty labels on the issue ---
    if event_name not in ("issues", "pull_request"):
        print(f"::debug::Skipping — event '{event_name}' is not 'issues' or 'pull_request'")
        return

    # Get the issue data
    issue = event.get("issue", event.get("pull_request", {}))
    if not issue:
        print("::debug::No issue/pull_request found in event payload")
        return

    action = event.get("action", "")
    # Only act on opened issues or newly labeled issues
    if action not in ("opened", "labeled", "reopened"):
        print(f"::debug::Skipping — action '{action}' is not 'opened', 'labeled', or 'reopened'")
        return

    issue_number = issue.get("number")
    issue_title = issue.get("title", "")
    issue_body = issue.get("body", "") or ""
    issue_url = issue.get("html_url", "")
    issue_labels = [lbl.get("name", "") for lbl in issue.get("labels", [])]

    print(f"::debug::Processing issue #{issue_number}: {issue_title}")
    print(f"::debug::Issue labels: {issue_labels}")

    # Check if any of the configured bounty labels are present
    matched_tier = None
    matched_reward = None
    for label in issue_labels:
        if label in label_tier_map:
            tier, reward = label_tier_map[label]
            matched_tier = tier
            matched_reward = reward
            print(f"::debug::Matched label '{label}' → Tier {tier}, Reward {reward} $FNDRY")
            break

    if matched_tier is None:
        print(f"::notice::No bounty label matched on issue #{issue_number}. Issue labels: {issue_labels}")
        print(f"::notice::Configured bounty labels: {tier_labels}")
        return

    # --- Build the bounty payload ---
    # Detect category from repo topics or labels
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    category = "other"
    category_keywords = {
        "backend": "backend",
        "frontend": "frontend",
        "smart-contract": "smart-contract",
        "blockchain": "smart-contract",
        "design": "design",
        "ui": "frontend",
        "ux": "design",
        "devops": "devops",
        "infra": "devops",
        "security": "security",
        "docs": "documentation",
        "documentation": "documentation",
        "content": "content",
    }
    for lbl in issue_labels:
        lbl_lower = lbl.lower()
        for keyword, cat in category_keywords.items():
            if keyword in lbl_lower:
                category = cat
                break

    # Truncate title if too long
    title = issue_title[:200] if issue_title else f"Issue #{issue_number}"
    if len(title) < 3:
        title = f"Bounty: Issue #{issue_number}"

    # Build description from issue body
    description = issue_body
    if description:
        description = f"{description[:4000]}\n\n---\n\n*Auto-posted from {issue_url}*"
    else:
        description = f"*Auto-posted from {issue_url}*"

    payload = {
        "title": title,
        "description": description,
        "tier": matched_tier,
        "category": category,
        "reward_amount": matched_reward,
        "github_issue_url": issue_url,
        "created_by": f"github:{repo}",
    }

    print(f"::group::SolFoundry Bounty Payload")
    print(json.dumps(payload, indent=2))
    print(f"::endgroup::")

    # --- Post to SolFoundry ---
    result = call_solfoundry_api(api_key, payload)

    # Set outputs for downstream steps
    output_path = os.environ.get("GITHUB_OUTPUT")
    if output_path:
        with open(output_path, "a") as f:
            f.write(f"bounty-id={result.get('id', '')}\n")
            f.write(f"bounty-url=https://solfoundry.dev/bounties/{result.get('id', '')}\n")
            f.write(f"tier={matched_tier}\n")

    print(f"::notice::Bounty #{result.get('id', 'unknown')} posted successfully!")
    print(f"::notice::View at: https://solfoundry.dev/bounties/{result.get('id', '')}")


if __name__ == "__main__":
    main()