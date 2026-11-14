import express from "express";
import dotenv from "dotenv";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { GitHubScraper } from "./scraper/github-client";
import { BountyPoster } from "./scraper/bounty-poster";
import { handleGitHubWebhook } from "./api/webhooks/github";
import { ScraperConfig } from "./scraper/types";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);

// Initialize Services
const connection = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");
const adminWallet = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.ADMIN_PRIVATE_KEY!))
);

const scraper = new GitHubScraper(GITHUB_TOKEN);
const poster = new BountyPoster(connection, adminWallet, PROGRAM_ID);

// Configured Repositories to Scrape
const REPOS: ScraperConfig[] = [
  { owner: "SolFoundry", repo: "solfoundry", enabled: true }
];

// Webhook Endpoint
app.post("/webhooks/github", (req, res) => 
  handleGitHubWebhook(req, res, scraper, poster, WEBHOOK_SECRET)
);

// Cron-like Polling (Every 30 minutes)
setInterval(async () => {
  console.log("Starting scheduled scrape...");
  for (const config of REPOS) {
    if (!config.enabled) continue;
    const bounties = await scraper.fetchOpenBounties(config.owner, config.repo);
    for (const bounty of bounties) {
      // In production, add a check if bounty is already on-chain
      await poster.postToRegistry(bounty);
    }
  }
}, 30 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`SolFoundry Scraper Service running on port ${PORT}`);
});
