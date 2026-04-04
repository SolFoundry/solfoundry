import express, { type Request, type Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "./config/env";
import { buildReviewContext } from "./github/context";
import { getInstallationOctokit, githubApp } from "./github/client";
import { publishCheckRun, publishReview } from "./github/publisher";
import { performReview } from "./review-service";

const app = express();

app.use(express.json({
  verify: (request, _response, buffer) => {
    (request as Request & { rawBody?: Buffer }).rawBody = buffer;
  }
}));

app.get("/health", (_request: Request, response: Response) => {
  response.json({
    ok: true,
    appId: env.APP_ID,
    providers: env.providers
  });
});

app.get("/api/github/setup", async (_request: Request, response: Response) => {
  const manifestPath = path.resolve(process.cwd(), "config/github-app-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  response.json({
    manifest,
    installUrl: `https://github.com/apps/${encodeURIComponent(manifest.name.toLowerCase().replace(/\s+/g, "-"))}/installations/new`
  });
});

app.get("/api/github/setup/complete", (_request: Request, response: Response) => {
  response.status(200).send("GitHub App installation completed. Repository reviews will start on new pull requests.");
});

app.post("/api/github/webhooks", async (request: Request, response: Response) => {
  try {
    const eventName = request.header("x-github-event");
    const signature = request.header("x-hub-signature-256");
    const id = request.header("x-github-delivery");

    await githubApp.webhooks.verifyAndReceive({
      id: id ?? "",
      name: eventName ?? "",
      payload: JSON.stringify(request.body),
      signature: signature ?? ""
    });

    response.status(202).json({ accepted: true });
  } catch (error) {
    response.status(401).json({
      error: (error as Error).message
    });
  }
});

githubApp.webhooks.on("pull_request.opened", async ({ payload }) => handlePullRequest(payload));
githubApp.webhooks.on("pull_request.reopened", async ({ payload }) => handlePullRequest(payload));
githubApp.webhooks.on("pull_request.ready_for_review", async ({ payload }) => handlePullRequest(payload));
githubApp.webhooks.on("pull_request.synchronize", async ({ payload }) => handlePullRequest(payload));

githubApp.webhooks.onError((error) => {
  console.error("Webhook handling error", error);
});

async function handlePullRequest(payload: {
  installation?: { id: number };
  repository: { owner: { login: string }; name: string };
  pull_request: {
    draft: boolean;
    number: number;
    title: string;
    body: string | null;
    head: { sha: string; ref: string };
    base: { ref: string };
    user: { login: string };
  };
}) {
  if (payload.pull_request.draft || !payload.installation?.id) {
    return;
  }

  const octokit = await getInstallationOctokit(payload.installation.id);
  const context = await buildReviewContext(octokit, payload);
  const review = await performReview(context);

  await publishReview(octokit, {
    owner: context.owner,
    repo: context.repo,
    pullNumber: context.pullNumber,
    headSha: context.headSha,
    inline: context.repositoryConfig.commentPreferences.inline,
    summary: context.repositoryConfig.commentPreferences.summary,
    maxInlineComments: context.repositoryConfig.commentPreferences.maxInlineComments
  }, review);

  await publishCheckRun(octokit, {
    owner: context.owner,
    repo: context.repo,
    headSha: context.headSha
  }, review);
}

app.listen(env.PORT, () => {
  console.log(`AI Code Review GitHub App listening on ${env.PORT}`);
});
