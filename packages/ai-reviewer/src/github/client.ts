import { App } from "@octokit/app";
import type { RestEndpointMethodTypes } from "@octokit/rest";
import { env } from "../config/env";

export const githubApp = new App({
  appId: env.APP_ID,
  privateKey: env.privateKey,
  webhooks: {
    secret: env.WEBHOOK_SECRET
  }
});

export type PullRequestFile = RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"][number];

export async function getInstallationOctokit(installationId: number) {
  return githubApp.getInstallationOctokit(installationId);
}

export type InstallationOctokit = Awaited<ReturnType<typeof getInstallationOctokit>>;
