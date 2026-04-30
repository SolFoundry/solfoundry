"""AI Bounty Description Enhancer — Quick Test"""

from app.services.llm_service import enhance_bounty


async def test():
    print("=" * 50)
    print("Testing AI Bounty Description Enhancer")
    print("=" * 50)

    # Test with mock data
    print("\n1️⃣ Testing with mock (no API call)...")
    results = await enhance_bounty(
        title="Add dark mode toggle",
        description="Users need a dark mode option in the settings panel. Should use system preference by default.",
        use_mock=True,
    )

    print(f"\nGenerated {len(results)} enhancements:\n")
    for r in results:
        print(f"  [{r['style']}]")
        print(f"  Title: {r['enhanced_title']}")
        print(f"  Desc: {r['enhanced_description'][:100]}...")
        print(f"  ACs: {len(r['acceptance_criteria'])} criteria")
        print()

    print("✅ Mock test passed!")

    # Test with real LLM (if API key is available)
    print("\n2️⃣ Testing with real LLM (DeepSeek)...")
    real_results = await enhance_bounty(
        title="Add search bar to bounty list",
        description="The bounties page needs a search bar with debounce to filter bounties by title and description.",
        use_mock=False,
    )

    print(f"\nGenerated {len(real_results)} enhancements:\n")
    for r in real_results:
        print(f"  [{r['style']}]")
        print(f"  Title: {r['enhanced_title']}")
        print(f"  Using: {r['model']}")
        print()

    print("✅ Real LLM test passed!")


if __name__ == "__main__":
    import asyncio

    asyncio.run(test())
