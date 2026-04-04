import type { ProviderName } from "../types/review";
import { ClaudeReviewer } from "./claude";
import { CodexReviewer } from "./codex";
import { GeminiReviewer } from "./gemini";
import type { LLMReviewer } from "./base";

export function buildReviewers(): Record<ProviderName, LLMReviewer> {
  return {
    claude: new ClaudeReviewer(),
    codex: new CodexReviewer(),
    gemini: new GeminiReviewer()
  };
}
