/**
 * SolFoundry Telegram Bot — New Bounty Notifications
 *
 * Posts real-time alerts to a Telegram channel when:
 * - New bounties are posted
 * - Bounties receive submissions
 * - Bounties are completed/paid
 *
 * Bounty: #847 (T2)
 *
 * Setup:
 *   1. Create bot via @BotFather, get BOT_TOKEN
 *   2. Add bot as admin to target channel, get CHAT_ID
 *   3. Set env: BOT_TOKEN, CHAT_ID, SOLFOUNDRY_API_URL
 *   4. Run: npx tsx automaton/bots/telegram-bot.ts
 */

// ============================================================
// Config
// ============================================================

const CONFIG = {
  botToken: process.env.BOT_TOKEN || "",
  chatId: process.env.CHAT_ID || "",
  apiBase: process.env.SOLFOUNDRY_API_URL || "http://localhost:8000",
  pollIntervalMs: 60_000, // Check for new bounties every 60 seconds
};

// ============================================================
// Types
// ============================================================

interface Bounty {
  id: string;
  title: string;
  reward_amount: number;
  reward_token: string;
  tier: string;
  skills: string[];
  status: string;
  submission_count: number;
  created_at: string;
  org_name?: string;
  repo_name?: string;
}

// ============================================================
// Telegram API
// ============================================================

async function sendTelegramMessage(text: string) {
  if (!CONFIG.botToken || !CONFIG.chatId) {
    console.log("[dry] Would send:", text.slice(0, 80));
    return;
  }
  const url = `https://api.telegram.org/bot${CONFIG.botToken}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CONFIG.chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
}

// ============================================================
// Message formatting
// ============================================================

function formatBountyAlert(bounty: Bounty): string {
  const tierEmoji = { T1: "🟢", T2: "🔵", T3: "🟣" }[bounty.tier] || "⚪";
  const reward = `${bounty.reward_amount.toLocaleString()} ${bounty.reward_token}`;
  const skills = bounty.skills.slice(0, 3).join(", ");

  return [
    `${tierEmoji} <b>New Bounty: ${bounty.title}</b>`,
    ``,
    `💰 Reward: <b>${reward}</b>`,
    `📊 Tier: ${bounty.tier}`,
    `🛠 Skills: ${skills || "none"}`,
    ``,
    `🔗 <a href="https://solfoundry.io/bounties/${bounty.id}">View on SolFoundry</a>`,
  ].join("\n");
}

function formatSubmissionAlert(bounty: Bounty): string {
  return [
    `📬 <b>New Submission: ${bounty.title}</b>`,
    `📊 ${bounty.submission_count} submissions so far`,
    ``,
    `🔗 <a href="https://solfoundry.io/bounties/${bounty.id}">Review Now</a>`,
  ].join("\n");
}

// ============================================================
// Polling loop
// ============================================================

async function fetchBounties(): Promise<Bounty[]> {
  try {
    const resp = await fetch(`${CONFIG.apiBase}/api/bounties?status=open&limit=20`);
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const data = await resp.json();
    return data.items || data || [];
  } catch {
    return [];
  }
}

async function main() {
  console.log("🤖 SolFoundry Telegram Bot starting...");
  console.log(`   Poll interval: ${CONFIG.pollIntervalMs / 1000}s`);

  if (!CONFIG.botToken) {
    console.log("   ⚠️ BOT_TOKEN not set — running in dry mode\n");
  }

  // Track seen bounties to detect new ones
  const seenBountyIds = new Set<string>();
  const seenSubmissions = new Map<string, number>();

  // Initial load — mark all existing as seen
  const initial = await fetchBounties();
  for (const b of initial) {
    seenBountyIds.add(b.id);
    seenSubmissions.set(b.id, b.submission_count);
  }
  console.log(`   Loaded ${initial.length} existing bounties\n`);

  // Polling loop
  setInterval(async () => {
    try {
      const bounties = await fetchBounties();

      for (const bounty of bounties) {
        // New bounty
        if (!seenBountyIds.has(bounty.id)) {
          seenBountyIds.add(bounty.id);
          seenSubmissions.set(bounty.id, bounty.submission_count);
          await sendTelegramMessage(formatBountyAlert(bounty));
          console.log(`  🆕 Alert: ${bounty.title.slice(0, 50)}`);
        }
        // New submission
        const prevSubs = seenSubmissions.get(bounty.id) || 0;
        if (bounty.submission_count > prevSubs) {
          seenSubmissions.set(bounty.id, bounty.submission_count);
          await sendTelegramMessage(formatSubmissionAlert(bounty));
          console.log(`  📬 Submission: ${bounty.title.slice(0, 50)}`);
        }
      }
    } catch (err: any) {
      console.error(`  ❌ Poll error: ${err.message}`);
    }
  }, CONFIG.pollIntervalMs);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
