/**
 * Base LLM agent class for the autonomous bounty-hunting system.
 *
 * Each agent role (planner, implementer, verifier, reviewer, submitter)
 * extends this base class to provide role-specific behaviour while
 * sharing the LLM provider interface, prompt construction, and error
 * handling.
 *
 * In mock mode, agents return predefined responses instead of making
 * real LLM API calls, enabling deterministic testing.
 *
 * @module agent/agent
 */

import type { LLMProviderConfig, AgentRole } from './types.js';
import { NetworkError } from '../errors.js';

// ---------------------------------------------------------------------------
// LLM Completion
// ---------------------------------------------------------------------------

/** A single chat message in the LLM conversation. */
export interface LLMMessage {
  /** Role of the message sender. */
  readonly role: 'system' | 'user' | 'assistant';
  /** Message content. */
  readonly content: string;
}

/** Options for an LLM completion call. */
export interface CompletionOptions {
  /** Maximum tokens for the response. */
  readonly maxTokens?: number;
  /** Temperature override. */
  readonly temperature?: number;
}

/** Response from an LLM completion call. */
export interface CompletionResponse {
  /** Generated text content. */
  readonly content: string;
  /** Model that generated the response. */
  readonly model: string;
  /** Total tokens used (prompt + completion). */
  readonly totalTokens: number;
  /** Duration of the LLM call in milliseconds. */
  readonly durationMs: number;
}

// ---------------------------------------------------------------------------
// Base Agent
// ---------------------------------------------------------------------------

/**
 * Base class for all bounty-hunting agents.
 *
 * Provides the LLM completion interface, prompt construction helpers,
 * and structured output parsing. Subclasses implement their specific
 * logic via the `execute` method.
 */
export abstract class BaseAgent {
  /** The role this agent fulfills in the pipeline. */
  abstract readonly role: AgentRole;

  /** LLM provider configuration. */
  protected readonly provider: LLMProviderConfig;

  /** Whether to use mock responses (for testing). */
  protected readonly mockMode: boolean;

  /**
   * Create a new agent.
   *
   * @param provider - LLM provider configuration.
   * @param mockMode - If true, return mock responses instead of calling LLM.
   */
  constructor(provider: LLMProviderConfig, mockMode: boolean = false) {
    this.provider = provider;
    this.mockMode = mockMode;
  }

  /**
   * Execute the agent's core task.
   *
   * @param input - Input data for the agent (type varies by role).
   * @returns Result of the agent's work (type varies by role).
   */
  abstract execute(input: unknown): Promise<unknown>;

  /**
   * Call the LLM provider with a system prompt and user message.
   *
   * In mock mode, returns a canned response immediately.
   *
   * @param systemPrompt - System-level instructions for the LLM.
   * @param userMessage - The user's query or task description.
   * @param options - Optional completion parameters.
   * @returns The LLM completion response.
   * @throws {NetworkError} If the LLM API call fails.
   */
  protected async complete(
    systemPrompt: string,
    userMessage: string,
    options?: CompletionOptions,
  ): Promise<CompletionResponse> {
    if (this.mockMode) {
      return this.getMockResponse(systemPrompt, userMessage);
    }

    const startTime = Date.now();

    try {
      const response = await this.callLLM(systemPrompt, userMessage, options);
      return {
        content: response,
        model: this.provider.model,
        totalTokens: 0, // Token counting depends on provider
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      throw new NetworkError(
        `LLM API call failed for ${this.provider.provider}: ${String(error)}`,
        error as Error,
      );
    }
  }

  /**
   * Call the underlying LLM API.
   *
   * Subclasses can override this to use a specific provider SDK.
   * The default implementation uses the fetch API with OpenAI-compatible endpoints.
   *
   * @param systemPrompt - System prompt.
   * @param userMessage - User message.
   * @param options - Completion options.
   * @returns The generated text content.
   */
  protected async callLLM(
    systemPrompt: string,
    userMessage: string,
    options?: CompletionOptions,
  ): Promise<string> {
    const baseUrl = this.provider.baseUrl ?? 'https://api.openai.com/v1';
    const maxTokens = options?.maxTokens ?? this.provider.maxTokens ?? 4096;
    const temperature = options?.temperature ?? this.provider.temperature ?? 0.2;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.provider.apiKey}`,
      },
      body: JSON.stringify({
        model: this.provider.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`LLM API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content ?? '';
  }

  /**
   * Get a mock response for testing purposes.
   *
   * @param systemPrompt - The system prompt (used to determine response).
   * @param userMessage - The user message (used to determine response).
   * @returns A deterministic mock response.
   */
  protected getMockResponse(
    systemPrompt: string,
    userMessage: string,
  ): CompletionResponse {
    const startTime = Date.now();

    // Generate a deterministic mock response based on keywords in the prompts
    const combined = (systemPrompt + '\n' + userMessage).toLowerCase();

    let content = 'Mock response for testing.';

    // Order matters: check review/score BEFORE test/verify because the
    // reviewer system prompt includes "adequate tests" which would
    // otherwise trigger the verification branch.
    if (combined.includes('review') || combined.includes('score')) {
      content = JSON.stringify({
        modelName: this.provider.model,
        score: 8,
        codeQuality: 8,
        correctness: 9,
        security: 8,
        feedback: 'Well-structured code with good error handling.',
        approved: true,
      });
    } else if (combined.includes('plan') || combined.includes('analyze')) {
      content = JSON.stringify({
        summary: 'Mock implementation plan',
        steps: [
          {
            stepNumber: 1,
            description: 'Create module structure',
            files: ['src/module.ts'],
            effort: 2,
            dependsOn: [],
          },
          {
            stepNumber: 2,
            description: 'Implement core logic',
            files: ['src/module.ts'],
            effort: 3,
            dependsOn: [1],
          },
        ],
        risks: [],
        totalEffort: 5,
      });
    } else if (combined.includes('test') || combined.includes('verify')) {
      content = JSON.stringify({
        passed: true,
        testResults: [
          {
            suiteName: 'unit tests',
            passed: true,
            passedCount: 10,
            failedCount: 0,
            errors: [],
            durationMs: 500,
          },
        ],
        lintErrors: [],
        buildPassed: true,
        failureSummary: '',
      });
    } else if (combined.includes('code') || combined.includes('implement')) {
      content = '// Mock implementation\nconsole.log("Hello from mock agent");\n';
    } else if (combined.includes('scan') || combined.includes('bounty')) {
      content = JSON.stringify({
        candidates: [],
        scannedCount: 0,
        message: 'Mock scan completed.',
      });
    }

    return {
      content,
      model: this.provider.model,
      totalTokens: 50,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Parse a JSON string from an LLM response, handling common
   * formatting issues like markdown code fences.
   *
   * @param text - The raw LLM response text.
   * @returns Parsed JSON object.
   * @throws {Error} If the text cannot be parsed as JSON.
   */
  protected parseJSON<T>(text: string): T {
    // Remove markdown code fences if present
    let cleaned = text.trim();
    const jsonMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (jsonMatch) {
      cleaned = jsonMatch[1].trim();
    }

    return JSON.parse(cleaned) as T;
  }
}