import { env } from "../config/env";
import { loadRepositoryConfigFromContent } from "../config/repository-config";
import type { ChangedFile, ReviewContext } from "../types/review";
import type { InstallationOctokit, PullRequestFile } from "./client";

const CONFIG_CANDIDATES = [".ai-reviewer.yml", ".github/ai-reviewer.yml"];

async function loadRemoteRepositoryConfig(octokit: InstallationOctokit, owner: string, repo: string, ref: string) {
  for (const configPath of CONFIG_CANDIDATES) {
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: configPath,
        ref
      });

      if ("content" in data && data.content) {
        const decoded = Buffer.from(data.content, "base64").toString("utf8");
        return loadRepositoryConfigFromContent(decoded);
      }
    } catch {
      continue;
    }
  }

  return loadRepositoryConfigFromContent();
}

function trimPatch(patch?: string): string | undefined {
  if (!patch) {
    return undefined;
  }

  return patch.slice(0, env.MAX_PATCH_CHARS);
}

function toChangedFile(file: PullRequestFile): ChangedFile {
  return {
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    patch: trimPatch(file.patch)
  };
}

export async function buildReviewContext(
  octokit: InstallationOctokit,
  payload: {
    repository: { owner: { login: string }; name: string };
    pull_request: {
      number: number;
      title: string;
      body: string | null;
      head: { sha: string; ref: string };
      base: { ref: string };
      user: { login: string };
    };
  }
): Promise<ReviewContext> {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const pullNumber = payload.pull_request.number;
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100
  });

  const repositoryConfig = await loadRemoteRepositoryConfig(octokit, owner, repo, payload.pull_request.head.sha);

  return {
    owner,
    repo,
    pullNumber,
    title: payload.pull_request.title,
    body: payload.pull_request.body ?? "",
    headSha: payload.pull_request.head.sha,
    baseRef: payload.pull_request.base.ref,
    headRef: payload.pull_request.head.ref,
    author: payload.pull_request.user.login,
    changedFiles: files.slice(0, env.MAX_FILES_PER_REVIEW).map(toChangedFile),
    repositoryConfig
  };
}
