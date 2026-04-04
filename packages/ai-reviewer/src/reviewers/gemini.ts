import { env } from "../config/env";
import type { ReviewContext, ReviewOutput } from "../types/review";
import { buildReviewPrompt, normalizeReviewOutput, parseJsonResponse, type LLMReviewer } from "./base";

export class GeminiReviewer implements LLMReviewer {
  readonly name = "gemini" as const;

  isConfigured(): boolean {
    return Boolean(env.GEMINI_API_KEY);
  }

  async reviewCode(context: ReviewContext): Promise<ReviewOutput | null> {
    if (!env.GEMINI_API_KEY) {
      return null;
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json"
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: buildReviewPrompt(context)
                }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini review failed with status ${response.status}`);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "{}";
    return normalizeReviewOutput(this.name, parseJsonResponse(text));
  }
}
