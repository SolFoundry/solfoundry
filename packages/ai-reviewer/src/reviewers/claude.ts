import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";
import type { ReviewContext, ReviewOutput } from "../types/review";
import { buildReviewPrompt, normalizeReviewOutput, parseJsonResponse, type LLMReviewer } from "./base";

export class ClaudeReviewer implements LLMReviewer {
  readonly name = "claude" as const;
  private readonly client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

  isConfigured(): boolean {
    return Boolean(this.client);
  }

  async reviewCode(context: ReviewContext): Promise<ReviewOutput | null> {
    if (!this.client) {
      return null;
    }

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2500,
      temperature: 0,
      system: "You are a senior staff engineer performing code review. Reply with JSON only.",
      messages: [
        {
          role: "user",
          content: buildReviewPrompt(context)
        }
      ]
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return normalizeReviewOutput(this.name, parseJsonResponse(text));
  }
}
