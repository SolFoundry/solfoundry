import { apiClient } from '../services/apiClient';

export type ActivityEventType = 'completed' | 'submitted' | 'posted' | 'review' | 'payout';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

type ActivityResponse =
  | unknown[]
  | {
      items?: unknown[];
      events?: unknown[];
      activity?: unknown[];
    };

export interface ActivityListParams {
  limit?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function getNestedString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return isRecord(value)
    ? getString(value.login) ?? getString(value.username) ?? getString(value.name)
    : undefined;
}

function getAvatar(record: Record<string, unknown>): string | null | undefined {
  const actor = record.actor;
  const user = record.user;
  return (
    getString(record.avatar_url) ??
    (isRecord(actor) ? getString(actor.avatar_url) : undefined) ??
    (isRecord(user) ? getString(user.avatar_url) : undefined)
  );
}

function normalizeType(type: unknown): ActivityEventType {
  const normalized = getString(type)?.toLowerCase() ?? '';
  if (normalized.includes('review')) return 'review';
  if (normalized.includes('payout') || normalized.includes('paid') || normalized.includes('release')) return 'payout';
  if (normalized.includes('complete') || normalized.includes('earn')) return 'completed';
  if (normalized.includes('submit') || normalized.includes('pull_request') || normalized.includes('pr_')) return 'submitted';
  return 'posted';
}

export function normalizeActivityEvent(raw: unknown, index: number): ActivityEvent | null {
  if (!isRecord(raw)) return null;

  const timestamp =
    getString(raw.timestamp) ??
    getString(raw.created_at) ??
    getString(raw.createdAt) ??
    getString(raw.time);

  const detail =
    getString(raw.detail) ??
    getString(raw.message) ??
    getString(raw.title) ??
    getString(raw.description);

  if (!timestamp || !detail) return null;

  const username =
    getString(raw.username) ??
    getString(raw.actor_name) ??
    getNestedString(raw, 'actor') ??
    getNestedString(raw, 'user') ??
    'SolFoundry';

  return {
    id: getString(raw.id) ?? `${normalizeType(raw.type)}-${timestamp}-${index}`,
    type: normalizeType(raw.type ?? raw.event_type),
    username,
    avatar_url: getAvatar(raw) ?? null,
    detail,
    timestamp,
  };
}

export async function listActivity(params: ActivityListParams = {}): Promise<ActivityEvent[]> {
  const limit = params.limit ?? 4;
  const response = await apiClient<ActivityResponse>('/api/activity', {
    params: { limit },
  });

  const rawEvents = Array.isArray(response)
    ? response
    : response.items ?? response.events ?? response.activity ?? [];

  return rawEvents
    .map((event, index) => normalizeActivityEvent(event, index))
    .filter((event): event is ActivityEvent => event !== null)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, limit);
}
