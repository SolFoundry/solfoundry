// Review API Service

import type { ReviewDashboard, Appeal, LLMReview } from '../types/review';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function fetchReviewDashboard(submissionId: string): Promise<ReviewDashboard> {
  const response = await fetch(`${API_BASE}/api/reviews/${submissionId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch review dashboard: ${response.statusText}`);
  }
  return response.json();
}

export async function submitAppeal(submissionId: string, reason: string): Promise<Appeal> {
  const response = await fetch(`${API_BASE}/api/appeals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissionId, reason }),
  });
  if (!response.ok) {
    throw new Error(`Failed to submit appeal: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchAppeal(appealId: string): Promise<Appeal> {
  const response = await fetch(`${API_BASE}/api/appeals/${appealId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch appeal: ${response.statusText}`);
  }
  return response.json();
}

export async function updateAppealStatus(appealId: string, status: string, notes?: string): Promise<Appeal> {
  const response = await fetch(`${API_BASE}/api/appeals/${appealId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update appeal status: ${response.statusText}`);
  }
  return response.json();
}

export async function assignReviewer(appealId: string, reviewerId: string): Promise<Appeal> {
  const response = await fetch(`${API_BASE}/api/appeals/${appealId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewerId }),
  });
  if (!response.ok) {
    throw new Error(`Failed to assign reviewer: ${response.statusText}`);
  }
  return response.json();
}
