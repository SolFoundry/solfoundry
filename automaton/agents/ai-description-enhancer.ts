/**
 * AI Bounty Description Enhancer
 *
 * Uses an LLM to rewrite and enhance bounty descriptions:
 * - Standardizes formatting
 * - Adds missing sections (Acceptance Criteria, Tech Stack)
 * - Improves clarity for AI reviewers
 * - Rates original description quality
 *
 * Bounty: #848 (450K FNDRY, T2)
 *
 * Usage:
 *   npx tsx automaton/agents/ai-description-enhancer.ts
 *   npx tsx automaton/agents/ai-description-enhancer.ts --bounty-id 123
 *   npx tsx automaton/agents/ai-description-enhancer.ts --dry-run
 */

// ============================================================
// Config
// ============================================================

const CONFIG = {
  apiBase: process.env.SOLFOUNDRY_API_URL || "http://localhost:8000",
  llmEndpoint: process.env.LLM_API_ENDPOINT || "https://api.anthropic.com/v1/messages",
  llmApiKey: process.env.LLM_API_KEY || "",
  llmModel: process.env.LLM_MODEL || "claude-sonnet-4-20250514",
  /** Minimum description length to attempt enhancement */
  minEnhanceLength: 50,
};

// ============================================================
// Types
// ============================================================

interface BountyDescription {
  id: string;
  title: string;
  description: string;
  skills: string[];
}

interface EnhancementResult {
  enhanced_description: string;
  quality_score: number; // 1-10
  improvements: string[];
  suggested_skills: string[];
}

// ============================================================
// LLM integration
// ============================================================

const SYSTEM_PROMPT = `You are a bounty description enhancer for SolFoundry.

Given a raw bounty description, enhance it to be clear, well-structured, and reviewer-friendly.
Follow strictly the output format.

## Enhancement Rules
1. Add missing sections: Overview, Requirements, Acceptance Criteria, Tech Stack
2. Fix grammar and spelling
3. Standardize formatting with markdown headings
4. Extract implicit skills from the description
5. Be specific — replace vague language with concrete requirements

## Output Format (JSON)

{
  "enhanced_description": "## Overview\\n...\\n\\n## Requirements\\n- ...\\n\\n## Acceptance Criteria\\n- [ ] ...\\n\\n## Tech Stack\\n- ...",
  "quality_score": 7,
  "improvements": ["Added Acceptance Criteria section", "Fixed grammar"],
  "suggested_skills": ["typescript", "react"]
}

Return ONLY valid JSON. No explanatory text.`;

async function enhanceDescription(
  bounty: BountyDescription
): Promise<EnhancementResult | null> {
  if (!CONFIG.llmApiKey) {
    console.log("  (dry mode — LLM_API_KEY not set)");
    return null;
  }

  const userPrompt = `## Bounty Title\n${bounty.title}\n\n## Current Description\n${bounty.description}\n\n## Current Skills\n${bounty.skills.join(", ") || "none"}\n\nEnhance this bounty description.`;

  try {
    const resp = await fetch(CONFIG.llmEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CONFIG.llmApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CONFIG.llmModel,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!resp.ok) throw new Error(`LLM API ${resp.status}`);

    const data = await resp.json();
    const text = data.content?.[0]?.text || "";
    // Extract JSON from possible markdown wrapper
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (err: any) {
    console.error(`  LLM error: ${err.message}`);
    return null;
  }
}

// ============================================================
// Fetch bounties needing enhancement
// ============================================================

async function fetchBounties(): Promise<BountyDescription[]> {
  try {
    const resp = await fetch(`${CONFIG.apiBase}/api/bounties?status=open&limit=50`);
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const data = await resp.json();
    const items = data.items || data || [];

    return items
      .filter(
        (b: any) =>
          (b.description?.length || 0) < CONFIG.minEnhanceLength ||
          !b.description?.includes("##") // lacks markdown structure
      )
      .map((b: any) => ({
        id: b.id,
        title: b.title,
        description: b.description || "",
        skills: b.skills || [],
      }));
  } catch {
    return [];
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`🤖 AI Bounty Description Enhancer${dryRun ? " (dry-run)" : ""}\n`);

  const bounties = await fetchBounties();
  console.log(`Found ${bounties.length} bounties needing enhancement\n`);

  for (const b of bounties) {
    console.log(`  📝 Enhancing: ${b.title.slice(0, 60)}`);
    const result = await enhanceDescription(b);

    if (result) {
      console.log(`    Quality: ${result.quality_score}/10`);
      console.log(`    Skills: ${result.suggested_skills.join(", ")}`);
      console.log(`    Improvements: ${result.improvements.join("; ")}`);

      if (!dryRun) {
        // POST enhanced description back to SolFoundry
        try {
          const resp = await fetch(
            `${CONFIG.apiBase}/api/bounties/${b.id}/description`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                description: result.enhanced_description,
                skills: [...new Set([...b.skills, ...result.suggested_skills])],
                quality_score: result.quality_score,
              }),
            }
          );
          console.log(`    ${resp.ok ? "✅ Updated" : `⚠️ API ${resp.status}`}`);
        } catch (err: any) {
          console.log(`    ❌ Error: ${err.message}`);
        }
      }
    } else {
      console.log(`    ⏭️ Skipped (no enhancement available)`);
    }
    console.log();
  }

  console.log("✅ Done.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
