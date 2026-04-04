import OpenAI from "openai";
import { env } from "../config/env";
import type { ReviewContext, ReviewOutput } from "../types/review";
import { buildReviewPrompt, normalizeReviewOutput, parseJsonResponse, type LLMReviewer } from "./base";

export class CodexReviewer implements LLMReviewer {
  readonly name = "codex" as const;
  private readonly client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

  isConfigured(): boolean {
    return Boolean(this.client);
  }

  async reviewCode(context: ReviewContext): Promise<ReviewOutput | null> {
    if (!this.client) {
      return null;
    }

    const response = await this.client.responses.create({
      model: "gpt-5.4",
      temperature: 0,
      input: [
        {
          role: "system",
          content: "You are a staff engineer performing code review. Respond with JSON only."
        },
        {
          role: "user",
          content: buildReviewPrompt(context)
        }
      ]
    });

    const text = response.output_text;
    return normalizeReviewOutput(this.name, parseJsonResponse(text));
  }
}
