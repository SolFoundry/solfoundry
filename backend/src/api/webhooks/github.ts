import { Request, Response } from "express";
import crypto from "crypto";
import { GitHubScraper } from "../../scraper/github-client";
import { BountyPoster } from "../../scraper/bounty-poster";

interface WebhookRequest extends Request {
  rawBody?: Buffer;
}

export const handleGitHubWebhook = async (
  req: WebhookRequest, 
  res: Response, 
  scraper: GitHubScraper, 
  poster: BountyPoster,
  webhookSecret: string
) => {
  // Verify Signature
  const signature = req.headers["x-hub-signature-256"];
  if (!signature) {
    return res.status(401).send("Missing signature");
  }

  const hmac = crypto.createHmac("sha256", webhookSecret);
  // Use the raw body buffer captured by express.json() verify middleware
  const digest = "sha256=" + hmac.update(req.rawBody || "").digest("hex");

  if (signature !== digest) {
    return res.status(401).send("Invalid signature");
  }

  const { action, issue } = req.body;

  // Logic: When an issue is labeled with a tier or opened with a tier label
  // Ensure issue exists in payload
  if (issue && (action === "labeled" || action === "opened" || action === "edited")) {
    const hasBountyLabel = issue.labels.some((l: any) => l.name === "bounty");
    
    if (hasBountyLabel) {
      const bountyData = scraper.mapIssueToBounty(issue);
      if (bountyData) {
        try {
          await poster.postToRegistry(bountyData);
        } catch (err) {
          console.error("Failed to post bounty from webhook:", err);
          return res.status(500).send("Internal Server Error");
        }
      }
    }
  }

  return res.status(200).send("Processed");
};
