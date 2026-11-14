import { Request, Response } from "express";
import crypto from "crypto";
import { GitHubScraper } from "../../scraper/github-client";
import { BountyPoster } from "../../scraper/bounty-poster";

export const handleGitHubWebhook = async (
  req: Request, 
  res: Response, 
  scraper: GitHubScraper, 
  poster: BountyPoster,
  webhookSecret: string
) => {
  // Verify Signature
  const signature = req.headers["x-hub-signature-256"];
  const hmac = crypto.createHmac("sha256", webhookSecret);
  const digest = "sha256=" + hmac.update(JSON.stringify(req.body)).digest("hex");

  if (signature !== digest) {
    return res.status(401).send("Invalid signature");
  }

  const { action, issue, label } = req.body;

  // Logic: When an issue is labeled with a tier or opened with a tier label
  if (
    (action === "labeled" || action === "opened") &&
    issue.labels.some((l: any) => l.name === "bounty")
  ) {
    const bountyData = scraper.mapIssueToBounty(issue);
    if (bountyData) {
      await poster.postToRegistry(bountyData);
    }
  }

  return res.status(200).send("Processed");
};
