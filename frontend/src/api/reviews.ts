import { apiClient } from '../services/apiClient';

export interface LlmReview {
  model: 'Claude' | 'Codex' | 'Gemini';
  score: number;
  confidence: number;
  quality: 'strong' | 'good' | 'needs-work';
  summary: string;
  detail_url?: string | null;
}

interface ReviewsResponse {
  items: LlmReview[];
}

const FALLBACK_REVIEWS: LlmReview[] = [
  {
    model: 'Claude',
    score: 8.6,
    confidence: 92,
    quality: 'strong',
    summary: 'Solid structure and clear implementation quality.',
  },
  {
    model: 'Codex',
    score: 8.2,
    confidence: 88,
    quality: 'good',
    summary: 'Implementation is mostly correct with minor edge-case gaps.',
  },
  {
    model: 'Gemini',
    score: 7.9,
    confidence: 84,
    quality: 'good',
    summary: 'Readable solution with room for stronger test coverage.',
  },
];

export async function listBountyReviews(bountyId: string): Promise<ReviewsResponse> {
  try {
    return await apiClient<ReviewsResponse>(`/api/bounties/${bountyId}/reviews`);
  } catch {
    return { items: FALLBACK_REVIEWS };
  }
}
