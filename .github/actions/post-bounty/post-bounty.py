#!/usr/bin/env python3
"""SolFoundry Post Bounty — core logic.

Reads bounty-issue metadata from SOLFOUNDRY_* environment variables and
POSTs a bounty to the SolFoundry platform (POST /api/bounties).
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

# --------------------------------------------------------------------------- #
# inputs (all from SOLFOUNDRY_* env vars passed by the composite action)
# --------------------------------------------------------------------------- #
def inp(name, default=""):
    return os.environ.get(name, default)

SOLFOUNDRY_TOKEN        = inp("SOLFOUNDRY_TOKEN")
SOLFOUNDRY_API_URL      = inp("SOLFOUNDRY_API_URL", "https://solfoundry.dev").rstrip("/")
SOLFOUNDRY_BOUNTY_LABELS = [l.strip().lower() for l in
    inp("SOLFOUNDRY_BOUNTY_LABELS", "bounty,tier-1,tier-2,tier-3").split(",") if l.strip()]
SOLFOUNDRY_DEFAULT_REWARD_AMOUNT = int(inp("SOLFOUNDRY_DEFAULT_REWARD_AMOUNT", "1000"))
SOLFOUNDRY_DEFAULT_REWARD_TOKEN  = inp("SOLFOUNDRY_DEFAULT_REWARD_TOKEN", "FNDRY").upper()
SOLFOUNDRY_DEFAULT_TIER          = inp("SOLFOUNDRY_DEFAULT_TIER", "T1").upper()
SOLFOUNDRY_REQUIRE_TIER_LABEL    = inp("SOLFOUNDRY_REQUIRE_TIER_LABEL", "false").lower() == "true"
SOLFOUNDRY_LABEL_SKIP            = inp("SOLFOUNDRY_LABEL_SKIP", "solfoundry-synced")
SOLFOUNDRY_GH_TOKEN              = inp("SOLFOUNDRY_GH_TOKEN", "")
SOLFOUNDRY_AUTO_SYNC_LABEL       = inp("SOLFOUNDRY_AUTO_SYNC_LABEL", "true").lower() == "true"
SOLFOUNDRY_DRY_RUN               = inp("SOLFOUNDRY_DRY_RUN", "false").lower() == "true"

ISSUE_BODY      = os.environ.get("SOLFOUNDRY_ISSUE_BODY", "")
ISSUE_TITLE     = os.environ.get("SOLFOUNDRY_ISSUE_TITLE", "")
ISSUE_URL       = os.environ.get("SOLFOUNDRY_ISSUE_URL", "")
ISSUE_NUMBER    = os.environ.get("SOLFOUNDRY_ISSUE_NUMBER", "")
ISSUE_LABELS    = [l.strip().lower() for l in
    os.environ.get("SOLFOUNDRY_ISSUE_LABELS", "").split(",") if l.strip()]
REPO            = os.environ.get("SOLFOUNDRY_REPO", "")

GITHUB_API      = "https://api.github.com"

# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def note(msg):
    print(f"::notice::{msg}")

def err(msg):
    print(f"::error::{msg}")

def debug(msg):
    print(f"::debug::{msg}")

def gh_post(path, data, token):
    url = f"{GITHUB_API}/{path}"
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/vnd.github.v3+json")
    req.add_header("Authorization", f"Bearer {token}")
    return urllib.request.urlopen(req, timeout=20)

def post_solfoundry(url, payload, token):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    return urllib.request.urlopen(req, timeout=30)

# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main():
    note(f"SolFoundry Post Bounty — repo={REPO} issue=#{ISSUE_NUMBER}")
    matched = [l for l in ISSUE_LABELS if l in SOLFOUNDRY_BOUNTY_LABELS]
    debug(f"matched bounty labels: {matched}")

    # 1. qualifies?
    if "bounty" not in ISSUE_LABELS:
        debug("no 'bounty' label — skipping")
        return
    if SOLFOUNDRY_LABEL_SKIP.lower() in ISSUE_LABELS:
        note(f"has {SOLFOUNDRY_LABEL_SKIP} label — skipping (already synced)")
        return
    tier_label = next((l for l in ISSUE_LABELS if l in ("tier-1", "tier-2", "tier-3")), None)
    if not tier_label and SOLFOUNDRY_REQUIRE_TIER_LABEL:
        debug("no tier-* label and require_tier_label=true — skipping")
        return

    note(f"bounty issue detected: {ISSUE_TITLE}")

    # 2. parse reward amount + token from body
    body = ISSUE_BODY
    reward_amount = SOLFOUNDRY_DEFAULT_REWARD_AMOUNT
    token_tok = SOLFOUNDRY_DEFAULT_REWARD_TOKEN
    token_matches = re.findall(r"\b(USDC|FNDRY)\b", body, re.IGNORECASE)
    if token_matches:
        token_tok = token_matches[0].upper()
    reward_patterns = [
        r"\b(\d[\d,]*)\s*K\s*\$?(?:FNDRY|USDC)",
        r"\b(\d[\d,]*)\s*\$?(?:FNDRY|USDC)",
        r"\breward\s*(?:amount)?\s*[:=]\s*\$?\s*(\d[\d,]*)",
    ]
    for pat in reward_patterns:
        m = re.search(pat, body, re.IGNORECASE)
        if m:
            val = int(m.group(1).replace(",", ""))
            if "K" in pat.upper():
                val *= 1000
            reward_amount = val
            break
    debug(f"parsed reward={reward_amount} {token_tok}")

    # 3. map tier
    tier_map = {"tier-1": "T1", "tier-2": "T2", "tier-3": "T3"}
    tier = tier_map.get(tier_label, SOLFOUNDRY_DEFAULT_TIER)
    debug(f"tier={tier}")

    # 4. build payload (matches BountyCreatePayload)
    payload = {
        "title": ISSUE_TITLE.strip() or "Untitled Bounty",
        "description": body.strip(),
        "reward_amount": reward_amount,
        "reward_token": token_tok,
        "tier": tier,
        "github_repo_url": ("https://github.com/" + REPO).rstrip("/") if REPO else None,
        "github_issue_url": ISSUE_URL,
        "skills": ["general"],
    }
    payload = {k: v for k, v in payload.items() if v is not None}

    print("::group::Payload to SolFoundry")
    print(json.dumps(payload, indent=2))
    print("::endgroup::")

    if SOLFOUNDRY_DRY_RUN:
        note("DRY_RUN=true — nothing sent")
        return

    # 5. POST
    url = f"{SOLFOUNDRY_API_URL}/api/bounties"
    try:
        note(f"POST {url}")
        resp = post_solfoundry(url, payload, SOLFOUNDRY_TOKEN)
        status = resp.status
        text = resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        err(f"SolFoundry rejected the bounty (HTTP {e.code})")
        err(e.read().decode("utf-8", "replace")[:500])
        sys.exit(1)
    except Exception as e:
        err(f"network error posting bounty: {e}")
        sys.exit(1)

    note(f"SolFoundry responded {status}")
    print("::group::SolFoundry response")
    print(text[:2000])
    print("::endgroup::")

    # 6. add synced label
    if SOLFOUNDRY_AUTO_SYNC_LABEL and SOLFOUNDRY_GH_TOKEN and REPO and ISSUE_NUMBER:
        try:
            gh_post(
                f"repos/{REPO}/issues/{ISSUE_NUMBER}/labels",
                [SOLFOUNDRY_LABEL_SKIP],
                SOLFOUNDRY_GH_TOKEN,
            )
            note(f"added {SOLFOUNDRY_LABEL_SKIP} label to issue")
        except urllib.error.HTTPError as e:
            note(f"could not add label (HTTP {e.code}): " + e.read().decode("utf-8", "replace")[:200])
        except Exception as e:
            note(f"could not add label: {e}")

    note(f"Bounty synced successfully (#{ISSUE_NUMBER} -> {ISSUE_URL})")


if __name__ == "__main__":
    main()
