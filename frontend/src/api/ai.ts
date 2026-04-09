/**
 * AI Description Enhancement API
 * @module api/ai
 */

import { apiClient } from '../services/apiClient';

export interface DescriptionEnhanceRequest {
  title: string;
  description: string;
  tier?: string;
  provider?: 'claude' | 'openai' | 'gemini';
}

export interface EnhancedDescription {
  title: string;
  description: string;
  acceptance_criteria: string[];
  suggested_skills: string[];
  suggested_tier: string;
  provider: string;
  confidence: number;
}

export interface MultiLLMResult {
  claude: EnhancedDescription | null;
  openai: EnhancedDescription | null;
  gemini: EnhancedDescription | null;
  consensus: EnhancedDescription;
}

/**
 * Enhance a bounty description using AI.
 * Calls the backend endpoint which orchestrates multi-LLM analysis.
 */
export async function enhanceDescription(
  payload: DescriptionEnhanceRequest,
): Promise<MultiLLMResult> {
  return apiClient<MultiLLMResult>('/api/ai/enhance-description', {
    method: 'POST',
    body: payload,
    timeoutMs: 30_000,
  });
}

/**
 * Quick single-provider enhancement (lighter weight).
 */
export async function enhanceDescriptionQuick(
  title: string,
  description: string,
): Promise<EnhancedDescription> {
  return apiClient<EnhancedDescription>('/api/ai/enhance-description/quick', {
    method: 'POST',
    body: { title, description },
    timeoutMs: 15_000,
  });
}
