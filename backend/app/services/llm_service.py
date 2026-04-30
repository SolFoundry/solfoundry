"""
LLM Service — Calls multiple AI models to enhance bounty descriptions
"""

import json
import httpx
from typing import Optional
from app.config import settings


# System prompts for different "personality" enhancements
ENHANCE_PROMPTS = {
    "technical": {
        "name": "Technical Deep Dive",
        "model": "deepseek-chat",
        "system": """You are a senior software engineer reviewing a bounty description.
Your task is to enhance it with:
1. A clearer, more technical title
2. Detailed acceptance criteria with edge cases
3. Technical implementation hints
4. Estimated effort level

Be precise and thorough. Output JSON only.""",
    },
    "creative": {
        "name": "Creative & Visionary",
        "model": "deepseek-chat",
        "system": """You are a product visionary enhancing a bounty description.
Your task is to make it:
1. More compelling and inspiring
2. Highlight the impact and value
3. Suggest creative approaches
4. Add visual/UX considerations

Be inspiring but practical. Output JSON only.""",
    },
    "concise": {
        "name": "Concise & Actionable",
        "model": "deepseek-chat",
        "system": """You are a project manager tightening a bounty description.
Your task is to make it:
1. Minimal but complete
2. Clear deliverables and timeline
3. Obvious success criteria
4. Ready for immediate assignment

Cut fluff, keep essentials. Output JSON only.""",
    },
}

USER_PROMPT_TEMPLATE = """Enhance this bounty description:

Title: {title}
Description: {description}

Respond with valid JSON in this exact format:
{{
  "enhanced_title": "string",
  "enhanced_description": "string (2-4 sentences)",
  "acceptance_criteria": ["string", "string", ...],
  "examples": ["string", "string", ...]
}}"""


async def call_llm(
    system_prompt: str,
    user_prompt: str,
    model: str = "deepseek-chat",
    api_key: Optional[str] = None,
) -> Optional[dict]:
    """Call an LLM and return parsed JSON response"""
    if not api_key:
        api_key = settings.deepseek_api_key

    base = settings.deepseek_base_url

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(
                f"{base}/chat/completions",
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                    "max_tokens": 2000,
                },
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]

            # Parse JSON from response
            # Handle markdown-wrapped JSON
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            return json.loads(content)

        except httpx.HTTPStatusError as e:
            print(f"[LLM] HTTP error: {e.response.status_code} {e.response.text[:200]}")
        except json.JSONDecodeError as e:
            print(f"[LLM] JSON parse error: {e}")
            print(f"[LLM] Raw content: {content[:500] if 'content' in dir() else 'N/A'}")
        except Exception as e:
            print(f"[LLM] Error: {e}")

    return None


async def generate_mock_enhancement(
    title: str, description: str, style: str = "technical"
) -> dict:
    """Generate a mock enhancement when LLM is unavailable"""
    styles = {
        "technical": {
            "enhanced_title": f"[Tech] {title}",
            "enhanced_description": f"{description}\n\nImplementation requires careful consideration of edge cases, error handling, and performance. The solution should be modular and testable.",
            "acceptance_criteria": [
                "Implementation handles all error cases gracefully",
                "Unit tests cover >80% of code paths",
                "Performance meets <100ms response time P99",
                "Documentation covers API and setup",
            ],
            "examples": [
                "Example input: POST /api/enhance with valid JSON body",
                "Example output: 200 OK with enhanced description object",
            ],
        },
        "creative": {
            "enhanced_title": f"✨ {title}",
            "enhanced_description": f"Imagine a world where {description.lower()}. This bounty is your chance to build something that users will love and remember.",
            "acceptance_criteria": [
                "Delightful user experience with smooth animations",
                "Accessible and responsive across all devices",
                "Clean, well-documented code for future contributors",
            ],
            "examples": [
                "User story: As a bounty hunter, I want to see enhanced descriptions so I can quickly understand the task",
            ],
        },
        "concise": {
            "enhanced_title": title,
            "enhanced_description": description[:200],
            "acceptance_criteria": [
                "Feature works as described",
                "No regressions in existing functionality",
            ],
            "examples": [],
        },
    }
    return styles.get(style, styles["technical"])


async def enhance_bounty(
    title: str, description: str, use_mock: bool = False
) -> list:
    """
    Enhance a bounty description using 3 LLM approaches.
    Returns a list of 3 enhancement results.
    """
    results = []
    user_prompt = USER_PROMPT_TEMPLATE.format(title=title, description=description)

    for key, config in ENHANCE_PROMPTS.items():
        if use_mock:
            result = await generate_mock_enhancement(title, description, key)
        else:
            result = await call_llm(
                system_prompt=config["system"],
                user_prompt=user_prompt,
                model=config["model"],
            )
            if result is None:
                # Fallback to mock
                result = await generate_mock_enhancement(title, description, key)

        results.append({
            "style": config["name"],
            "model": config["model"],
            **result,
        })

    return results
