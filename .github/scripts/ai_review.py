#!/usr/bin/env python3
"""
SolFoundry Multi-LLM Code Review Pipeline
Runs GPT-5.4 + Gemini 2.5 Pro + Grok 4 in parallel.
Spam filter gate before expensive reviews.
Posts aggregated review on PR + sends to Telegram.
"""

import os
import json
import requests
import re
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Config ──────────────────────────────────────────────────────────────────
MODELS = {
    "gpt": {"name": "GPT-5.4", "model": "gpt-5.4-mini", "role": "Code Quality & Correctness"},
    "gemini": {"name": "Gemini 2.5 Pro", "model": "gemini-2.5-pro", "role": "Logic, Completeness & Architecture"},
    "grok": {"name": "Grok 4", "model": "grok-4-fast-reasoning", "role": "Security & Edge Cases"},
}

REVIEW_PROMPT = """You are a senior code reviewer for SolFoundry, an AI software factory on Solana.
Your focus area: {focus}

Review this pull request diff. The PR is a bounty submission from an external contributor.

PR Title: {pr_title}
PR Description: {pr_body}

Evaluate (1-10 each):
1. **Code Quality**: Clean code, naming, conventions, no dead code
2. **Correctness**: Logic errors, edge cases, does it work?
3. **Security**: XSS, injection, secrets, unsafe patterns
4. **Completeness**: Matches bounty spec? Missing features?
5. **Tests**: Test coverage, quality of tests

Provide:
- **Overall verdict**: APPROVE, REQUEST_CHANGES, or REJECT
- **Summary**: 2-3 sentences
- **Issues**: Specific problems with file paths
- **Suggestions**: Non-blocking improvements

Be strict but fair. We pay $FNDRY bounties for quality work only.

DIFF:
```
{diff}
```

Respond in this exact JSON format:
{{
  "quality_score": 7,
  "quality_note": "...",
  "correctness_score": 8,
  "correctness_note": "...",
  "security_score": 9,
  "security_note": "...",
  "completeness_score": 6,
  "completeness_note": "...",
  "tests_score": 3,
  "tests_note": "...",
  "overall_score": 6.6,
  "verdict": "REQUEST_CHANGES",
  "summary": "...",
  "issues": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1"]
}}"""


# ── Spam Filter ─────────────────────────────────────────────────────────────
def spam_check(diff: str, pr_body: str, pr_title: str) -> dict:
    """Fast pre-filter before running expensive LLM reviews.
    Returns {pass: bool, reason: str}"""

    # 1. Empty or trivial diff
    if len(diff.strip()) < 50:
        return {"pass": False, "reason": "Empty or trivial diff (<50 chars)"}

    # 2. Suspiciously small — just a README edit or single comment
    lines = [l for l in diff.split("\n") if l.startswith("+") and not l.startswith("+++")]
    code_lines = [l for l in lines if l.strip() not in ("+", "+#", "+//", "+/*", "+*/", "+'''", '+"""')]
    if len(code_lines) < 5:
        return {"pass": False, "reason": f"Only {len(code_lines)} lines of actual code added"}

    # 3. No linked bounty issue
    has_closes = bool(re.search(r'(?:closes|fixes|resolves)\s+#\d+', (pr_body or "").lower()))
    if not has_closes:
        return {"pass": False, "reason": "No linked bounty issue (missing 'Closes #N')"}

    # 4. AI slop detection — massive files with repetitive patterns
    if diff.count("TODO") > 20 or diff.count("placeholder") > 15:
        return {"pass": False, "reason": "Excessive TODOs/placeholders — looks like AI slop"}

    # 5. Suspiciously large — dumping an entire framework
    if len(diff) > 200000:
        return {"pass": False, "reason": f"Diff too large ({len(diff)//1000}KB) — suspicious bulk dump"}

    # 6. Binary files or node_modules
    if "node_modules/" in diff or "Binary file" in diff[:5000]:
        return {"pass": False, "reason": "Contains binary files or node_modules"}

    # 7. Copy-paste detection — same block repeated many times
    chunks = diff.split("\n")
    if len(chunks) > 100:
        seen = {}
        for chunk in chunks:
            c = chunk.strip()
            if len(c) > 40:
                seen[c] = seen.get(c, 0) + 1
        max_repeats = max(seen.values()) if seen else 0
        if max_repeats > 20:
            return {"pass": False, "reason": f"Heavy copy-paste detected ({max_repeats} repeated lines)"}

    return {"pass": True, "reason": "Passed all spam checks"}


# ── LLM Reviewers ───────────────────────────────────────────────────────────
def review_openai(diff: str, pr_title: str, pr_body: str) -> dict:
    """GPT-5.4 review — Code Quality & Correctness focus."""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

        prompt = REVIEW_PROMPT.format(
            focus="Code quality, correctness, and naming conventions",
            pr_title=pr_title, pr_body=pr_body or "No description.", diff=diff
        )

        response = client.chat.completions.create(
            model=MODELS["gpt"]["model"],
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        result["_model"] = MODELS["gpt"]["name"]
        result["_status"] = "ok"
        return result
    except Exception as e:
        print(f"OpenAI review failed: {e}")
        return {"_model": MODELS["gpt"]["name"], "_status": "error", "_error": str(e)}


def review_gemini(diff: str, pr_title: str, pr_body: str) -> dict:
    """Gemini 2.5 Pro review — Logic, Completeness & Architecture focus."""
    try:
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            return {"_model": MODELS["gemini"]["name"], "_status": "skipped", "_error": "No API key"}

        prompt = REVIEW_PROMPT.format(
            focus="Logic correctness, architectural decisions, and completeness against spec",
            pr_title=pr_title, pr_body=pr_body or "No description.", diff=diff
        )

        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{MODELS['gemini']['model']}:generateContent?key={api_key}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.3,
                    "responseMimeType": "application/json"
                }
            },
            timeout=60
        )
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(text)
        result["_model"] = MODELS["gemini"]["name"]
        result["_status"] = "ok"
        return result
    except Exception as e:
        print(f"Gemini review failed: {e}")
        return {"_model": MODELS["gemini"]["name"], "_status": "error", "_error": str(e)}


def review_grok(diff: str, pr_title: str, pr_body: str) -> dict:
    """Grok 4 review — Security & Edge Cases focus."""
    try:
        api_key = os.environ.get("XAI_API_KEY", "")
        if not api_key:
            return {"_model": MODELS["grok"]["name"], "_status": "skipped", "_error": "No API key"}

        prompt = REVIEW_PROMPT.format(
            focus="Security vulnerabilities, edge cases, and potential exploits",
            pr_title=pr_title, pr_body=pr_body or "No description.", diff=diff
        )

        resp = requests.post(
            "https://api.x.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": MODELS["grok"]["model"],
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "response_format": {"type": "json_object"}
            },
            timeout=60
        )
        data = resp.json()
        text = data["choices"][0]["message"]["content"]
        result = json.loads(text)
        result["_model"] = MODELS["grok"]["name"]
        result["_status"] = "ok"
        return result
    except Exception as e:
        print(f"Grok review failed: {e}")
        return {"_model": MODELS["grok"]["name"], "_status": "error", "_error": str(e)}


# ── Aggregator ──────────────────────────────────────────────────────────────
def aggregate_reviews(reviews: list) -> dict:
    """Combine scores from multiple LLM reviews into one unified review."""
    valid = [r for r in reviews if r.get("_status") == "ok"]

    if not valid:
        return {
            "quality_score": 0, "quality_note": "All reviewers failed",
            "correctness_score": 0, "correctness_note": "All reviewers failed",
            "security_score": 0, "security_note": "All reviewers failed",
            "completeness_score": 0, "completeness_note": "All reviewers failed",
            "tests_score": 0, "tests_note": "All reviewers failed",
            "overall_score": 0, "verdict": "REJECT",
            "summary": "All LLM reviewers failed. Manual review required.",
            "issues": ["All automated reviewers encountered errors"],
            "suggestions": [],
            "models_used": [r.get("_model", "?") for r in reviews],
            "model_details": reviews,
        }

    n = len(valid)
    categories = ["quality", "correctness", "security", "completeness", "tests"]

    agg = {}
    for cat in categories:
        scores = [r.get(f"{cat}_score", 0) for r in valid]
        notes = [f"**{r.get('_model', '?')}:** {r.get(f'{cat}_note', 'N/A')}" for r in valid]
        agg[f"{cat}_score"] = round(sum(scores) / n, 1)
        agg[f"{cat}_note"] = " | ".join(notes)

    # Overall score = average of category averages
    cat_scores = [agg[f"{cat}_score"] for cat in categories]
    agg["overall_score"] = round(sum(cat_scores) / len(cat_scores), 1)

    # Verdict = majority vote, biased toward caution
    verdicts = [r.get("verdict", "REQUEST_CHANGES") for r in valid]
    if verdicts.count("REJECT") >= 2 or (verdicts.count("REJECT") >= 1 and n <= 2):
        agg["verdict"] = "REJECT"
    elif verdicts.count("APPROVE") > n / 2:
        agg["verdict"] = "APPROVE"
    else:
        agg["verdict"] = "REQUEST_CHANGES"

    # Merge summaries
    summaries = [f"**{r.get('_model', '?')}:** {r.get('summary', '')}" for r in valid]
    agg["summary"] = "\n".join(summaries)

    # Merge issues (deduplicate similar ones)
    all_issues = []
    for r in valid:
        for issue in r.get("issues", []):
            issue_str = str(issue) if not isinstance(issue, str) else issue
            # Simple dedup — skip if very similar issue already exists
            if not any(issue_str[:30].lower() in existing.lower() for existing in all_issues):
                all_issues.append(f"[{r.get('_model', '?')}] {issue_str}")
    agg["issues"] = all_issues[:10]  # Cap at 10

    # Merge suggestions
    all_suggestions = []
    for r in valid:
        for s in r.get("suggestions", []):
            s_str = str(s) if not isinstance(s, str) else s
            all_suggestions.append(f"[{r.get('_model', '?')}] {s_str}")
    agg["suggestions"] = all_suggestions[:8]

    # Metadata
    agg["models_used"] = [r.get("_model", "?") for r in valid]
    agg["models_failed"] = [r.get("_model", "?") for r in reviews if r.get("_status") != "ok"]
    agg["model_details"] = [{
        "model": r.get("_model", "?"),
        "score": r.get("overall_score", 0),
        "verdict": r.get("verdict", "?")
    } for r in valid]

    return agg


# ── Post to GitHub ──────────────────────────────────────────────────────────
def post_pr_comment(review: dict):
    """Post the aggregated multi-LLM review as a PR comment."""
    pr_number = os.environ["PR_NUMBER"]
    repo = os.environ.get("GITHUB_REPOSITORY", "SolFoundry/solfoundry")
    token = os.environ["GH_TOKEN"]

    verdict_emoji = {"APPROVE": "\u2705", "REQUEST_CHANGES": "\u26a0\ufe0f", "REJECT": "\u274c"}
    emoji = verdict_emoji.get(review["verdict"], "\u2753")

    # Individual model scores
    model_scores = ""
    for md in review.get("model_details", []):
        m_emoji = verdict_emoji.get(md.get("verdict", ""), "\u2753")
        model_scores += f"| {md['model']} | {md['score']}/10 | {m_emoji} {md['verdict']} |\n"

    # Category scores
    categories = ["quality", "correctness", "security", "completeness", "tests"]
    cat_rows = ""
    for cat in categories:
        score = review.get(f"{cat}_score", 0)
        bar = "\u2588" * int(score) + "\u2591" * (10 - int(score))
        cat_rows += f"| {cat.title()} | {bar} {score}/10 |\n"

    issues_md = "\n".join(f"- {i}" for i in review.get("issues", [])) or "None found."
    suggestions_md = "\n".join(f"- {s}" for s in review.get("suggestions", [])) or "None."
    failed_note = ""
    if review.get("models_failed"):
        failed_note = f"\n> \u26a0\ufe0f Models failed: {', '.join(review['models_failed'])}\n"

    body = f"""## {emoji} Multi-LLM Code Review — {review['verdict']}

**Aggregated Score: {review['overall_score']}/10** (from {len(review.get('models_used', []))} models)
{failed_note}
### Model Verdicts
| Model | Score | Verdict |
|-------|-------|---------|
{model_scores}
### Category Scores (Averaged)
| Category | Score |
|----------|-------|
{cat_rows}
### Summary
{review['summary']}

### Issues
{issues_md}

### Suggestions
{suggestions_md}

---
*Reviewed by SolFoundry Multi-LLM Pipeline: {', '.join(review.get('models_used', []))}*
"""

    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}
    resp = requests.post(url, json={"body": body}, headers=headers)
    print(f"PR comment posted: {resp.status_code}")


# ── Post to Telegram ────────────────────────────────────────────────────────
def send_telegram(review: dict):
    """Send aggregated review to Telegram with action buttons."""
    bot_token = os.environ.get("SOLFOUNDRY_TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("SOLFOUNDRY_TELEGRAM_CHAT_ID")
    if not bot_token or not chat_id:
        print("Telegram not configured — skipping")
        return

    pr_number = os.environ["PR_NUMBER"]
    pr_title = os.environ["PR_TITLE"]
    pr_author = os.environ["PR_AUTHOR"]
    pr_url = os.environ["PR_URL"]

    verdict_emoji = {"APPROVE": "\u2705", "REQUEST_CHANGES": "\u26a0\ufe0f", "REJECT": "\u274c"}
    emoji = verdict_emoji.get(review["verdict"], "\u2753")

    # Bounty context
    bounty_issue = os.environ.get("BOUNTY_ISSUE", "")
    bounty_title = os.environ.get("BOUNTY_TITLE", "")
    bounty_tier = os.environ.get("BOUNTY_TIER", "")
    bounty_reward = os.environ.get("BOUNTY_REWARD", "0")
    submission_order = os.environ.get("SUBMISSION_ORDER", "0")

    tier_emoji = {"tier-1": "\U0001f7e2", "tier-2": "\U0001f7e1", "tier-3": "\U0001f534"}
    t_emoji = tier_emoji.get(bounty_tier, "")

    bounty_line = ""
    if bounty_issue:
        order_map = {"1": "1st \U0001f947", "2": "2nd \U0001f948", "3": "3rd \U0001f949"}
        order_text = order_map.get(str(submission_order), f"#{submission_order}")
        bounty_line = (
            f"\n{t_emoji} <b>Bounty #{bounty_issue}:</b> {bounty_title}"
            f"\n\U0001f4b0 {bounty_reward} $FNDRY | {bounty_tier.upper().replace('-',' ')} | Submission: {order_text}"
        )

    # Model verdict breakdown
    model_lines = ""
    for md in review.get("model_details", []):
        m_emoji = verdict_emoji.get(md.get("verdict", ""), "\u2753")
        model_lines += f"\n  {m_emoji} {md['model']}: {md['score']}/10"

    # Min score check per tier
    min_scores = {"tier-1": 6, "tier-2": 7, "tier-3": 8}
    min_score = min_scores.get(bounty_tier, 0)
    score_warning = ""
    if min_score > 0 and review["overall_score"] < min_score:
        score_warning = f"\n\u26a0\ufe0f <b>Below {bounty_tier.replace('-',' ').upper()} minimum ({min_score}/10)</b>"
    elif min_score > 0:
        score_warning = f"\n\u2705 Meets {bounty_tier.replace('-',' ').upper()} threshold ({min_score}/10)"

    # Top issues
    issues_preview = ""
    if review.get("issues"):
        top = review["issues"][:3]
        issues_preview = "\n\n<b>Top Issues:</b>\n" + "\n".join(f"  \u2022 {i[:80]}" for i in top)

    msg = (
        f"{emoji} <b>PR #{pr_number}: {pr_title}</b>"
        f"\n\U0001f464 {pr_author}{bounty_line}"
        f"\n"
        f"\n<b>Aggregated: {review['overall_score']}/10 — {review['verdict']}</b>{score_warning}"
        f"\n<b>Models:</b>{model_lines}"
        f"\n"
        f"\n<b>Quality:</b> {review.get('quality_score',0)} | <b>Correct:</b> {review.get('correctness_score',0)} | <b>Security:</b> {review.get('security_score',0)}"
        f"\n<b>Complete:</b> {review.get('completeness_score',0)} | <b>Tests:</b> {review.get('tests_score',0)}"
        f"{issues_preview}"
    )

    # Truncate if too long
    if len(msg) > 3800:
        msg = msg[:3800] + "\n\n<i>... truncated</i>"

    inline_keyboard = [
        [
            {"text": "\u2705 Approve & Merge", "callback_data": f"pr_approve_{pr_number}"},
            {"text": "\u26a0\ufe0f Request Changes", "callback_data": f"pr_changes_{pr_number}"}
        ],
        [
            {"text": "\u274c Deny & Close", "callback_data": f"pr_deny_{pr_number}"},
            {"text": "\U0001f916 Re-review", "callback_data": f"pr_review_{pr_number}"}
        ],
        [
            {"text": "\U0001f517 View on GitHub", "url": pr_url}
        ]
    ]

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    resp = requests.post(url, json={
        "chat_id": chat_id,
        "text": msg,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": {"inline_keyboard": inline_keyboard}
    })
    print(f"Telegram notification: {resp.status_code}")

    # Save review state for bot
    try:
        import pathlib
        data_dir = pathlib.Path.home() / ".solfoundry" / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        state_file = data_dir / "state.json"
        state = json.loads(state_file.read_text()) if state_file.exists() else {}
        if "pending_prs" not in state:
            state["pending_prs"] = {}
        state["pending_prs"][str(pr_number)] = {
            "title": pr_title, "author": pr_author, "url": pr_url,
            "score": review["overall_score"], "verdict": review["verdict"],
            "models": review.get("model_details", []),
            "reviewed_at": datetime.now().isoformat()
        }
        if "stats" not in state:
            state["stats"] = {}
        state["stats"]["prs_reviewed"] = state["stats"].get("prs_reviewed", 0) + 1
        state_file.write_text(json.dumps(state, indent=2, default=str))
    except Exception as e:
        print(f"State save warning: {e}")


def send_spam_rejection(reason: str):
    """Notify Telegram that a PR was auto-rejected as spam."""
    bot_token = os.environ.get("SOLFOUNDRY_TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("SOLFOUNDRY_TELEGRAM_CHAT_ID")
    if not bot_token or not chat_id:
        return

    pr_number = os.environ.get("PR_NUMBER", "?")
    pr_title = os.environ.get("PR_TITLE", "?")
    pr_author = os.environ.get("PR_AUTHOR", "?")
    pr_url = os.environ.get("PR_URL", "")

    msg = (
        f"\U0001f6ab <b>PR #{pr_number} — Spam Filtered</b>"
        f"\n\U0001f464 {pr_author}"
        f"\n\U0001f4cb {pr_title}"
        f"\n\n<b>Reason:</b> {reason}"
        f"\n<i>No LLM review run — saved API credits</i>"
    )

    keyboard = [[{"text": "\U0001f517 View on GitHub", "url": pr_url}]] if pr_url else []

    requests.post(
        f"https://api.telegram.org/bot{bot_token}/sendMessage",
        json={
            "chat_id": chat_id, "text": msg, "parse_mode": "HTML",
            "disable_web_page_preview": True,
            "reply_markup": {"inline_keyboard": keyboard} if keyboard else {}
        }
    )


# ── Main ────────────────────────────────────────────────────────────────────
def main():
    print("SolFoundry Multi-LLM Review Pipeline starting...")

    # Read diff
    with open("/tmp/pr_diff.txt", "r") as f:
        diff = f.read()
    if len(diff) > 30000:
        diff = diff[:30000] + "\n\n... [diff truncated — too large for full review]"

    pr_title = os.environ.get("PR_TITLE", "Unknown PR")
    pr_body = os.environ.get("PR_BODY", "")

    print(f"PR: {pr_title}")
    print(f"Diff: {len(diff)} chars")

    # Step 1: Spam filter
    spam = spam_check(diff, pr_body, pr_title)
    if not spam["pass"]:
        print(f"SPAM FILTERED: {spam['reason']}")
        if not os.environ.get("SKIP_TELEGRAM"):
            send_spam_rejection(spam["reason"])
        return

    print("Passed spam filter — launching 3 LLM reviews in parallel...")

    # Step 2: Run all 3 LLMs in parallel
    results = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {
            pool.submit(review_openai, diff, pr_title, pr_body): "gpt",
            pool.submit(review_gemini, diff, pr_title, pr_body): "gemini",
            pool.submit(review_grok, diff, pr_title, pr_body): "grok",
        }
        for future in as_completed(futures):
            key = futures[future]
            try:
                results[key] = future.result()
                status = results[key].get("_status", "?")
                score = results[key].get("overall_score", "?")
                print(f"  {MODELS[key]['name']}: {status} (score: {score})")
            except Exception as e:
                print(f"  {MODELS[key]['name']}: EXCEPTION — {e}")
                results[key] = {"_model": MODELS[key]["name"], "_status": "error", "_error": str(e)}

    # Step 3: Aggregate
    all_reviews = [results.get("gpt", {}), results.get("gemini", {}), results.get("grok", {})]
    aggregated = aggregate_reviews(all_reviews)

    ok_count = len([r for r in all_reviews if r.get("_status") == "ok"])
    print(f"\nAggregated: {aggregated['overall_score']}/10 — {aggregated['verdict']} ({ok_count}/3 models succeeded)")

    # Step 4: Post to GitHub
    post_pr_comment(aggregated)

    # Step 5: Notify Telegram
    if not os.environ.get("SKIP_TELEGRAM"):
        send_telegram(aggregated)

    print("Multi-LLM review complete!")


if __name__ == "__main__":
    main()
