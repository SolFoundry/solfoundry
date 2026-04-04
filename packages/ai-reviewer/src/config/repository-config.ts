import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import type { ReviewConfig } from "../types/review";
import { env } from "./env";

const configSchema = z.object({
  strictness: z.enum(["lenient", "balanced", "strict"]).optional(),
  providers: z.array(z.enum(["claude", "codex", "gemini"])).optional(),
  commentPreferences: z.object({
    inline: z.boolean().optional(),
    summary: z.boolean().optional(),
    maxInlineComments: z.number().int().positive().optional()
  }).partial().optional(),
  approvalThresholds: z.object({
    blockOnCritical: z.boolean().optional(),
    requestChangesOnHighSeverityCount: z.number().int().nonnegative().optional()
  }).partial().optional(),
  customRules: z.array(z.object({
    id: z.string(),
    description: z.string(),
    include: z.array(z.string()).optional(),
    pattern: z.string().optional()
  })).optional()
});

export const defaultReviewConfig = (): ReviewConfig => ({
  strictness: env.strictness,
  providers: env.providers,
  commentPreferences: {
    inline: env.DEFAULT_INLINE_COMMENTS,
    summary: env.DEFAULT_SUMMARY_COMMENT,
    maxInlineComments: 10
  },
  approvalThresholds: {
    blockOnCritical: true,
    requestChangesOnHighSeverityCount: 2
  },
  customRules: []
});

export async function loadLocalDefaultConfig(): Promise<ReviewConfig> {
  const defaultsPath = path.resolve(process.cwd(), "config/defaults.json");
  const base = defaultReviewConfig();

  try {
    const file = await fs.readFile(defaultsPath, "utf8");
    const parsed = configSchema.parse(JSON.parse(file));
    return mergeConfigs(base, parsed);
  } catch {
    return base;
  }
}

export async function loadRepositoryConfigFromContent(content?: string): Promise<ReviewConfig> {
  const base = await loadLocalDefaultConfig();
  if (!content) {
    return base;
  }

  const parsed = configSchema.parse(YAML.parse(content) ?? {});
  return mergeConfigs(base, parsed);
}

function mergeConfigs(base: ReviewConfig, incoming: Partial<ReviewConfig>): ReviewConfig {
  return {
    strictness: incoming.strictness ?? base.strictness,
    providers: incoming.providers ?? base.providers,
    commentPreferences: {
      inline: incoming.commentPreferences?.inline ?? base.commentPreferences.inline,
      summary: incoming.commentPreferences?.summary ?? base.commentPreferences.summary,
      maxInlineComments: incoming.commentPreferences?.maxInlineComments ?? base.commentPreferences.maxInlineComments
    },
    approvalThresholds: {
      blockOnCritical: incoming.approvalThresholds?.blockOnCritical ?? base.approvalThresholds.blockOnCritical,
      requestChangesOnHighSeverityCount:
        incoming.approvalThresholds?.requestChangesOnHighSeverityCount ??
        base.approvalThresholds.requestChangesOnHighSeverityCount
    },
    customRules: incoming.customRules ?? base.customRules
  };
}
