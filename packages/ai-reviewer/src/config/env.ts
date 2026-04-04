import dotenv from "dotenv";
import { z } from "zod";
import type { ProviderName, StrictnessLevel } from "../types/review";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  APP_ID: z.string().min(1),
  WEBHOOK_SECRET: z.string().min(1),
  PRIVATE_KEY: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  DEFAULT_PROVIDERS: z.string().default("claude,codex,gemini"),
  DEFAULT_STRICTNESS: z.enum(["lenient", "balanced", "strict"]).default("balanced"),
  DEFAULT_INLINE_COMMENTS: z.coerce.boolean().default(true),
  DEFAULT_SUMMARY_COMMENT: z.coerce.boolean().default(true),
  MAX_PATCH_CHARS: z.coerce.number().default(12000),
  MAX_FILES_PER_REVIEW: z.coerce.number().default(25)
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  providers: parsed.DEFAULT_PROVIDERS.split(",").map((item) => item.trim()).filter(Boolean) as ProviderName[],
  strictness: parsed.DEFAULT_STRICTNESS as StrictnessLevel,
  privateKey: parsed.PRIVATE_KEY.replace(/\\n/g, "\n")
};
