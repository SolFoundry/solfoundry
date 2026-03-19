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
{tier_context}

Evaluate (1-10 each):
1. **Code Quality**: Clean code, naming, conventions, no dead code, no orphaned files
2. **Correctness**: Logic errors, edge cases, does it actually work as intended?
3. **Security**: XSS, injection, secrets, unsafe patterns
4. **Completeness**: Matches bounty spec? Missing features?
5. **Tests**: Test coverage, quality of tests
6. **Integration**: Does this code connect to the existing project? Are all files actually used?

IMPORTANT — Scoring calibration (USE THE FULL RANGE 1-10):
- 1-2: Broken, non-functional, or completely disconnected from the project
- 3-4: Major structural problems — files don't connect, wrong branding, bulk of code is dead/orphaned
- 5-6: Works but has significant issues — missing integration, no tests, sloppy structure
- 7-8: Solid, well-structured work that integrates properly and handles edge cases
- 9-10: Excellent production-grade code with tests, documentation, and clean architecture
- USE THE FULL RANGE. A submission with dead code and disconnected files is a 3, not a 5.

IMPORTANT — Structural integrity checks (score these HARD):
- If a CSS or JS file is submitted but never imported/linked from any HTML or entry point, that file is DEAD CODE. This should heavily penalize quality_score and integration_score (cap both at 4 max).
- If CSS class names or JS selectors don't match the HTML elements they target, the code is DISCONNECTED. Penalize correctness_score (cap at 4 max).
- If the submission uses different branding/naming than the project (e.g., "TokenFactory" instead of "SolFoundry"), penalize completeness_score significantly.
- If EVERY file in the PR is a new standalone file with zero imports from existing repo code, this is a DISCONNECTED SUBMISSION. It should score lower than one that properly extends the codebase.
- If the PR contains duplicate logic across files (e.g., same animations defined in both inline <style> and external CSS), penalize quality_score.
- Count how many submitted files are actually reachable from an entry point. If less than 70% are reachable, cap quality at 5.

IMPORTANT — Reward good engineering:
- Tests that cover edge cases, not just happy paths: +1 to tests_score
- Proper integration with existing repo code (imports, extends, modifies existing files): +1 to integration_score
- Clean separation of concerns (API/service/model layers): +1 to quality_score
- Documented tradeoffs or known limitations: shows engineering maturity, don't penalize

IMPORTANT — Feedback style rules:
- Be VAGUE about issues. Point to the AREA or CATEGORY of the problem, NOT the exact fix.
- Say "there are structural connectivity issues between the submitted files" NOT "script.js targets .feature-card but HTML uses .token-feature"
- Say "the submission has project coherence problems" NOT "it says TokenFactory instead of SolFoundry"
- Say "some submitted files may not be reachable from the application entry point" NOT "styles.css is never linked"
- Say "there are consistency issues across the codebase" NOT "inline CSS uses purple but external CSS uses orange"
- NEVER give code snippets, exact fixes, or copy-pasteable solutions.
- The goal is to tell them WHAT areas need work, not HOW to fix them.
- A skilled developer should understand the feedback. Someone copy-pasting into an AI should struggle.
- Reference general software engineering principles: "file reachability", "dead code elimination", "project coherence", "structural integrity"

Provide:
- **Overall verdict**: APPROVE, REQUEST_CHANGES, or REJECT
- **Summary**: 2-3 sentences on overall impression
- **Issues**: High-level areas that need work (NO exact fixes, NO line numbers, NO code)
- **Suggestions**: General directions for improvement (vague, reference engineering principles)

Be thorough and critical — this is an experiment proving autonomous agents can ship quality products.
But be FAIR. If the code works, integrates well, and addresses the spec, that should be reflected in high scores.
Well-engineered code with tests and proper integration should score 8-9. Disconnected files dumped into a repo should score 3-4.

DIFF:
```
{diff}
```

Respond in this exact JSON format:
{{
  "quality_score": 7,
  "quality_note": "brief general assessment, no specific fixes",
  "correctness_score": 8,
  "correctness_note": "brief general assessment, no specific fixes",
  "security_score": 9,
  "security_note": "brief general assessment, no specific fixes",
  "completeness_score": 6,
  "completeness_note": "brief general assessment, no specific fixes",
  "tests_score": 3,
  "tests_note": "brief general assessment, no specific fixes",
  "integration_score": 7,
  "integration_note": "brief assessment of how well code connects to existing project",
  "overall_score": 6.6,
  "verdict": "REQUEST_CHANGES",
  "summary": "overall impression, 2-3 sentences",
  "issues": ["vague area-level problem, no fix given", "another area of concern"],
  "suggestions": ["general direction referencing engineering principles, not a specific solution"]
}}"""

# Tier-specific context injected into the prompt
TIER_PROMPTS = {
    "tier-1": (
        "\nBOUNTY TIER: Tier 1 — Basic tasks (UI components, styling, simple endpoints, docs, config)\n"
        "Low-risk contributions. No wallet logic, no auth, no financial operations.\n"
        "\n"
        "EXPECTATIONS FOR T1:\n"
        "- Code that works and addresses the bounty spec\n"
        "- All submitted files must be CONNECTED — every file should be reachable from an entry point\n"
        "- Branding and naming must match the project (SolFoundry, not placeholder names)\n"
        "- Clean structure and reasonable naming\n"
        "- Tests appreciated but NOT required — if absent, score tests_score as 4 (neutral)\n"
        "\n"
        "SCORING GUIDE FOR T1 (be generous on complexity, strict on coherence):\n"
        "- Well-integrated code with tests that works: 8-9\n"
        "- Working code, properly connected, no tests: 6-7\n"
        "- Code that renders/runs but has orphaned files or disconnected structure: 3-5\n"
        "- Disconnected files, wrong branding, dead code: 2-4\n"
        "\n"
        "T1 is forgiving on sophistication but NOT on structural integrity.\n"
        "A simple component that properly integrates > a fancy one with dead files."
    ),
    "tier-2": (
        "\nBOUNTY TIER: Tier 2 — Standard tasks (API integrations, data pipelines, complex UI with state)\n"
        "Moderate risk. May touch backend logic, external APIs, or user data.\n"
        "\n"
        "EXPECTATIONS FOR T2:\n"
        "- Solid implementation with proper error handling and input validation\n"
        "- Tests REQUIRED for core logic paths — no tests = cap at 5.5 max overall\n"
        "- Must integrate with existing repo code (import existing modules, extend existing patterns)\n"
        "- All submitted files must be connected and reachable\n"
        "- Frontend: must handle error/loading/empty states\n"
        "- Backend: proper separation of concerns (routes/services/models)\n"
        "\n"
        "SCORING GUIDE FOR T2:\n"
        "- Production-grade with tests, integration, error handling: 8-9\n"
        "- Working code with tests but minor gaps: 6-7\n"
        "- Works but missing tests or poor integration: 4-6\n"
        "- Structural issues, orphaned files, no error handling: 2-4\n"
    ),
    "tier-3": (
        "\nBOUNTY TIER: Tier 3 — Critical tasks (wallet integration, auth, payments, security, smart contracts)\n"
        "HIGH RISK. Touches money, credentials, or security boundaries. Be STRICT.\n"
        "\n"
        "EXPECTATIONS FOR T3:\n"
        "- Production-grade code. No shortcuts, no placeholders, no TODOs in critical paths.\n"
        "- Comprehensive test suite including edge cases, failure modes, and boundary conditions\n"
        "- Security must be airtight — injection, validation, race conditions, error exposure\n"
        "- Input validation on ALL external data. Fail closed, never open.\n"
        "- Must integrate with existing auth/wallet/security patterns in the repo\n"
        "- Code review by a senior engineer should find no surprises\n"
        "\n"
        "SCORING GUIDE FOR T3:\n"
        "- Battle-tested with comprehensive tests and security review: 8-10\n"
        "- Solid but with minor security or test gaps: 6-7\n"
        "- Missing critical tests or security considerations: 3-5\n"
        "- Any structural issues, dead code, or integration gaps: automatic cap at 4\n"
        "\n"
        "APPROVE only if all categories ≥ 7, security ≥ 8, and tests ≥ 7."
    ),
    "unknown": (
        "\nBOUNTY TIER: Unknown — apply Tier 2 standards as default.\n"
        "Focus on correctness, integration, and security. If the task appears security-critical, be strict."
    ),
}

# Category weights per tier — determines how much each category affects overall score
# Higher weight = more impact on final score. Weights sum to 1.0 per tier.
# Integration = are files connected, do they extend existing code, no orphans
TIER_WEIGHTS = {
    #                    quality  correct  security  complete  tests   integration
    "tier-1":  {"quality": 0.20, "correctness": 0.25, "security": 0.10, "completeness": 0.15, "tests": 0.10, "integration": 0.20},
    "tier-2":  {"quality": 0.15, "correctness": 0.20, "security": 0.15, "completeness": 0.15, "tests": 0.15, "integration": 0.20},
    "tier-3":  {"quality": 0.10, "correctness": 0.15, "security": 0.25, "completeness": 0.10, "tests": 0.25, "integration": 0.15},
    "unknown": {"quality": 0.15, "correctness": 0.20, "security": 0.15, "completeness": 0.15, "tests": 0.15, "integration": 0.20},
}


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

    # 6. Binary files or committed node_modules (not just references in config/gitignore)
    if "Binary file" in diff[:5000]:
        return {"pass": False, "reason": "Contains binary files"}
    # Only flag node_modules if actual module files are being added (not gitignore/config refs)
    node_module_files = [l for l in diff.split("\n") if l.startswith("+++ b/node_modules/")]
    if len(node_module_files) > 0:
        return {"pass": False, "reason": "Contains committed node_modules"}

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
def review_openai(diff: str, pr_title: str, pr_body: str, tier: str = "unknown") -> dict:
    """GPT-5.4 review — Code Quality & Correctness focus."""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

        tier_context = TIER_PROMPTS.get(tier, TIER_PROMPTS["unknown"])
        prompt = REVIEW_PROMPT.format(
            focus="Code quality, correctness, and naming conventions",
            pr_title=pr_title, pr_body=pr_body or "No description.", diff=diff,
            tier_context=tier_context
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


def review_gemini(diff: str, pr_title: str, pr_body: str, tier: str = "unknown") -> dict:
    """Gemini 2.5 Pro review — Logic, Completeness & Architecture focus."""
    try:
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            return {"_model": MODELS["gemini"]["name"], "_status": "skipped", "_error": "No API key"}

        tier_context = TIER_PROMPTS.get(tier, TIER_PROMPTS["unknown"])
        prompt = REVIEW_PROMPT.format(
            focus="Logic correctness, architectural decisions, and completeness against spec",
            pr_title=pr_title, pr_body=pr_body or "No description.", diff=diff,
            tier_context=tier_context
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


def review_grok(diff: str, pr_title: str, pr_body: str, tier: str = "unknown") -> dict:
    """Grok 4 review — Security & Edge Cases focus."""
    try:
        api_key = os.environ.get("XAI_API_KEY", "")
        if not api_key:
            return {"_model": MODELS["grok"]["name"], "_status": "skipped", "_error": "No API key"}

        tier_context = TIER_PROMPTS.get(tier, TIER_PROMPTS["unknown"])
        prompt = REVIEW_PROMPT.format(
            focus="Security vulnerabilities, edge cases, and potential exploits",
            pr_title=pr_title, pr_body=pr_body or "No description.", diff=diff,
            tier_context=tier_context
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
def aggregate_reviews(reviews: list, tier: str = "unknown") -> dict:
    """Combine scores from multiple LLM reviews into one unified review.
    Weights categories differently based on bounty tier."""
    valid = [r for r in reviews if r.get("_status") == "ok"]

    if not valid:
        return {
            "quality_score": 0, "quality_note": "All reviewers failed",
            "correctness_score": 0, "correctness_note": "All reviewers failed",
            "security_score": 0, "security_note": "All reviewers failed",
            "completeness_score": 0, "completeness_note": "All reviewers failed",
            "tests_score": 0, "tests_note": "All reviewers failed",
            "integration_score": 0, "integration_note": "All reviewers failed",
            "overall_score": 0, "verdict": "REJECT",
            "summary": "All LLM reviewers failed. Manual review required.",
            "issues": ["All automated reviewers encountered errors"],
            "suggestions": [],
            "models_used": [r.get("_model", "?") for r in reviews],
            "model_details": reviews,
        }

    n = len(valid)
    categories = ["quality", "correctness", "security", "completeness", "tests", "integration"]

    agg = {}
    for cat in categories:
        # If a model doesn't return integration_score (backward compat), use quality_score as proxy
        fallback = "quality_score" if cat == "integration" else None
        scores = []
        for r in valid:
            s = r.get(f"{cat}_score")
            if s is None and fallback:
                s = r.get(fallback, 5)
            scores.append(s if s is not None else 0)
        notes = [f"**{r.get('_model', '?')}:** {r.get(f'{cat}_note', 'N/A')}" for r in valid]
        agg[f"{cat}_score"] = round(sum(scores) / n, 1)
        agg[f"{cat}_note"] = " | ".join(notes)

    # Overall score = WEIGHTED average based on tier
    # T1: quality + correctness matter most, tests barely count
    # T3: security + tests matter most (money/auth code)
    weights = TIER_WEIGHTS.get(tier, TIER_WEIGHTS["unknown"])
    weighted_score = sum(agg[f"{cat}_score"] * weights[cat] for cat in categories)
    agg["overall_score"] = round(weighted_score, 1)

    # Verdict = SCORE-BASED per tier, not majority vote
    # With recalibrated scoring, these thresholds reflect real quality bars
    tier_approve_thresholds = {
        "tier-1": 6.0,   # Basic tasks — must be structurally sound, connected code
        "tier-2": 7.0,   # Standard tasks — need solid quality + tests + integration
        "tier-3": 8.0,   # Critical tasks — production-grade, comprehensive tests required
        "unknown": 7.0,
    }
    approve_threshold = tier_approve_thresholds.get(tier, 6.5)

    # Hard rejection: if any model says REJECT AND score is very low
    verdicts = [r.get("verdict", "REQUEST_CHANGES") for r in valid]
    if verdicts.count("REJECT") >= 2:
        agg["verdict"] = "REJECT"
    elif agg["overall_score"] >= approve_threshold:
        agg["verdict"] = "APPROVE"
    elif agg["overall_score"] < approve_threshold - 1.5:
        # More than 1.5 below threshold — reject, don't just request changes
        agg["verdict"] = "REJECT" if agg["overall_score"] < 3.5 else "REQUEST_CHANGES"
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
    categories = ["quality", "correctness", "security", "completeness", "tests", "integration"]
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
def _is_solana_address(addr: str) -> bool:
    """Check if a string looks like a valid Solana address (base58, 32 bytes)."""
    if not addr:
        return False
    if addr.startswith("0x") or addr.startswith("0X"):
        return False
    if len(addr) < 32 or len(addr) > 48:
        return False
    # Base58 charset (no 0, O, I, l)
    import string
    b58_chars = set(string.digits + string.ascii_letters) - set("0OIl")
    if not all(c in b58_chars for c in addr):
        return False
    try:
        import base58
        decoded = base58.b58decode(addr)
        if len(decoded) != 32:
            return False
    except Exception:
        return False
    return True


def _extract_solana_wallet(pr_body: str) -> str:
    """Extract a Solana wallet address from PR body, filtering out non-Solana addresses."""
    if not pr_body:
        return None
    patterns = [
        r'\*\*Wallet:\*\*\s*`?([1-9A-HJ-NP-Za-km-z]{32,48})`?',
        r'[Ww]allet[:\s]+`?([1-9A-HJ-NP-Za-km-z]{32,48})`?',
        r'\*\*SOL[^*]*\*\*[:\s]*`?([1-9A-HJ-NP-Za-km-z]{32,48})`?',
        r'[Ss]ol(?:ana)?[:\s]+`?([1-9A-HJ-NP-Za-km-z]{32,48})`?',
        r'`([1-9A-HJ-NP-Za-km-z]{32,48})`',
        r'(?:^|\s)([1-9A-HJ-NP-Za-km-z]{43,48})(?:\s|$)',
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, pr_body):
            addr = match.group(1)
            if _is_solana_address(addr):
                return addr
    return None


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

    # Extract Solana wallet from PR body for display
    wallet_line = ""
    pr_body_text = os.environ.get("PR_BODY", "")
    if pr_body_text:
        wallet = _extract_solana_wallet(pr_body_text)
        if wallet:
            wallet_line = f"\n\U0001f4ac <b>Wallet:</b> <code>{wallet}</code> — <a href='https://solscan.io/account/{wallet}'>Verify on Solscan</a>"
        else:
            wallet_line = "\n\u26a0\ufe0f <b>No Solana wallet found in PR body</b>"

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
        f"\n\U0001f464 {pr_author}{bounty_line}{wallet_line}"
        f"\n"
        f"\n<b>Aggregated: {review['overall_score']}/10 — {review['verdict']}</b>{score_warning}"
        f"\n<b>Models:</b>{model_lines}"
        f"\n"
        f"\n<b>Quality:</b> {review.get('quality_score',0)} | <b>Correct:</b> {review.get('correctness_score',0)} | <b>Security:</b> {review.get('security_score',0)}"
        f"\n<b>Complete:</b> {review.get('completeness_score',0)} | <b>Tests:</b> {review.get('tests_score',0)} | <b>Integration:</b> {review.get('integration_score',0)}"
        f"{issues_preview}"
    )

    # Truncate if too long
    if len(msg) > 3800:
        msg = msg[:3800] + "\n\n<i>... truncated</i>"

    # Check if PR fails tier minimum
    below_threshold = min_score > 0 and review["overall_score"] < min_score

    if below_threshold:
        # AUTO-REQUEST CHANGES on GitHub — no manual action needed
        gh_token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN", "")
        repo = os.environ.get("GITHUB_REPOSITORY", "SolFoundry/solfoundry")
        headers = {
            "Authorization": f"token {gh_token}",
            "Accept": "application/vnd.github.v3+json"
        }

        # Build feedback from review issues
        feedback_parts = []
        if review.get("issues"):
            feedback_parts.append("**Issues found:**\n" + "\n".join(f"- {i}" for i in review["issues"][:5]))
        if review.get("suggestions"):
            feedback_parts.append("**Suggestions:**\n" + "\n".join(f"- {s}" for s in review["suggestions"][:3]))
        feedback = "\n\n".join(feedback_parts) if feedback_parts else f"AI review scored this PR {review['overall_score']}/10 (minimum required: {min_score}/10)."

        changes_comment = (
            f"\u26a0\ufe0f **Changes Requested** (Score: {review['overall_score']}/10 — minimum: {min_score}/10)\n\n"
            f"{feedback}\n\n"
            f"Please address these items and push an update. "
            f"If no update within 72 hours, this PR will be automatically closed.\n\n"
            f"---\n*SolFoundry Review Bot*"
        )

        # Post changes-requested comment
        requests.post(
            f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments",
            json={"body": changes_comment}, headers=headers
        )
        # Add changes-requested label
        requests.post(
            f"https://api.github.com/repos/{repo}/issues/{pr_number}/labels",
            json={"labels": ["changes-requested"]}, headers=headers
        )
        print(f"Auto-requested changes on PR #{pr_number} (score {review['overall_score']} < {min_score})")

        # Telegram: info-only with just Override Approve
        msg += f"\n\n\U0001f6a8 <b>Auto-requested changes on GitHub. Will auto-close in 72h if no update.</b>"
        inline_keyboard = [
            [
                {"text": "\u2705 Override Approve", "callback_data": f"pr_approve_{pr_number}"},
                {"text": "\U0001f517 View on GitHub", "url": pr_url}
            ]
        ]
    else:
        # PASSES threshold — show approve button only (you just tap approve)
        inline_keyboard = [
            [
                {"text": "\u2705 Approve & Merge", "callback_data": f"pr_approve_{pr_number}"},
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
        pr_state = {
            "title": pr_title, "author": pr_author, "url": pr_url,
            "score": review["overall_score"], "verdict": review["verdict"],
            "models": review.get("model_details", []),
            "reviewed_at": datetime.now().isoformat()
        }
        if below_threshold:
            pr_state["changes_requested_at"] = datetime.now().isoformat()
        state["pending_prs"][str(pr_number)] = pr_state
        if "stats" not in state:
            state["stats"] = {}
        state["stats"]["prs_reviewed"] = state["stats"].get("prs_reviewed", 0) + 1
        state_file.write_text(json.dumps(state, indent=2, default=str))
    except Exception as e:
        print(f"State save warning: {e}")


def close_pr_github(pr_number: str, comment: str):
    """Close a PR on GitHub with a comment."""
    gh_token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "SolFoundry/solfoundry")
    headers = {
        "Authorization": f"token {gh_token}",
        "Accept": "application/vnd.github.v3+json"
    }
    # Post comment
    requests.post(
        f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments",
        json={"body": comment}, headers=headers
    )
    # Close PR
    requests.patch(
        f"https://api.github.com/repos/{repo}/pulls/{pr_number}",
        json={"state": "closed"}, headers=headers
    )


def send_spam_rejection(reason: str):
    """Auto-close spam PR, comment with rules, and notify Telegram."""
    pr_number = os.environ.get("PR_NUMBER", "?")
    pr_title = os.environ.get("PR_TITLE", "?")
    pr_author = os.environ.get("PR_AUTHOR", "?")
    pr_url = os.environ.get("PR_URL", "")

    # Auto-close with comment on GitHub
    if pr_number != "?":
        close_pr_github(pr_number, (
            f"🚫 **Auto-closed — did not pass submission checks**\n\n"
            f"**Reason:** {reason}\n\n"
            f"### Submission Rules\n"
            f"- PR must link a bounty issue (`Closes #N`)\n"
            f"- Do not commit `node_modules/`, binary files, or build artifacts\n"
            f"- Include meaningful code changes (not just config/README edits)\n"
            f"- Keep submissions focused on the bounty scope\n"
            f"- No excessive TODOs/placeholders\n\n"
            f"Please review the [bounty rules](https://github.com/SolFoundry/solfoundry#-bounty-tiers) "
            f"and open a new PR when ready.\n\n"
            f"---\n*SolFoundry Review Bot*"
        ))
        print(f"Auto-closed PR #{pr_number} on GitHub")

    # Notify Telegram with reopen option
    bot_token = os.environ.get("SOLFOUNDRY_TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("SOLFOUNDRY_TELEGRAM_CHAT_ID")
    if not bot_token or not chat_id:
        return

    msg = (
        f"\U0001f6ab <b>PR #{pr_number} — Auto-Closed (Spam Filter)</b>"
        f"\n\U0001f464 {pr_author}"
        f"\n\U0001f4cb {pr_title}"
        f"\n\n<b>Reason:</b> {reason}"
        f"\n<i>PR closed with rules comment. No LLM review run.</i>"
    )

    keyboard = [[{"text": "\U0001f517 View PR", "url": pr_url}]] if pr_url else []

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

    # Get bounty tier from environment (set by workflow)
    bounty_tier = os.environ.get("BOUNTY_TIER", "unknown")
    if bounty_tier not in TIER_PROMPTS:
        bounty_tier = "unknown"
    print(f"Bounty tier: {bounty_tier}")
    print("Passed spam filter — launching 3 LLM reviews in parallel...")

    # Step 2: Run all 3 LLMs in parallel (with tier context)
    results = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {
            pool.submit(review_openai, diff, pr_title, pr_body, bounty_tier): "gpt",
            pool.submit(review_gemini, diff, pr_title, pr_body, bounty_tier): "gemini",
            pool.submit(review_grok, diff, pr_title, pr_body, bounty_tier): "grok",
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

    # Step 3: Aggregate (with tier-aware weighting)
    all_reviews = [results.get("gpt", {}), results.get("gemini", {}), results.get("grok", {})]
    aggregated = aggregate_reviews(all_reviews, tier=bounty_tier)

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
