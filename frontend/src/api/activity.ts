import { apiClient } from '../services/apiClient';
import type { ActivityEvent, ActivityEventType } from '../types/activity';

interface ActivityListParams {
  limit?: number;
}

type RawActivityEvent = Record<string, unknown>;
type ActivityApiResponse =
  | RawActivityEvent[]
  | {
      items?: RawActivityEvent[];
      events?: RawActivityEvent[];
      activity?: RawActivityEvent[];
      data?: RawActivityEvent[];
    };

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readNestedString(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  return readString((value as Record<string, unknown>)[key]);
}

function normalizeType(type: unknown): ActivityEventType {
  const normalized = readString(type)?.toLowerCase().replace(/[-\s]/g, '_');

  if (normalized === 'completed' || normalized === 'completion' || normalized === 'bounty_completed') {
    return 'completed';
  }
  if (normalized === 'submitted' || normalized === 'submission' || normalized === 'pr_submitted') {
    return 'submitted';
  }
  if (normalized === 'payout' || normalized === 'paid' || normalized === 'reward_paid') {
    return 'payout';
  }
  if (normalized === 'posted' || normalized === 'created' || normalized === 'bounty_posted') {
    return 'posted';
  }
  if (normalized === 'review' || normalized === 'ai_review' || normalized === 'review_passed') {
    return 'review';
  }

  return 'posted';
}

function buildDetail(raw: RawActivityEvent, type: ActivityEventType): string {
  const explicitDetail =
    readString(raw.detail) ??
    readString(raw.message) ??
    readString(raw.description) ??
    readString(raw.title) ??
    readString(raw.bounty_title);

  if (explicitDetail) return explicitDetail;

  const issueNumber = raw.issue_number ?? raw.bounty_number ?? raw.bounty_id;
  const amount = raw.amount ?? raw.reward_amount ?? raw.payout_amount;
  const token = readString(raw.token) ?? readString(raw.reward_token) ?? 'USDC';

  if (type === 'payout' && amount !== undefined) {
    return `${Number(amount).toLocaleString()} ${token}`;
  }
  if (issueNumber !== undefined) {
    return `Bounty #${String(issueNumber)}`;
  }

  return type === 'submitted' ? 'a pull request' : 'a bounty';
}

function normalizeActivityEvent(raw: RawActivityEvent, index: number): ActivityEvent {
  const type = normalizeType(raw.type ?? raw.event_type ?? raw.kind);
  const actor = raw.actor ?? raw.user ?? raw.contributor ?? raw.creator;
  const timestamp =
    readString(raw.timestamp) ??
    readString(raw.created_at) ??
    readString(raw.updated_at) ??
    new Date().toISOString();

  return {
    id: readString(raw.id) ?? readString(raw.event_id) ?? `${type}-${timestamp}-${index}`,
    type,
    username:
      readString(raw.username) ??
      readString(raw.actor_username) ??
      readNestedString(actor, 'username') ??
      readNestedString(actor, 'login') ??
      readNestedString(actor, 'name') ??
      'Someone',
    avatar_url:
      readString(raw.avatar_url) ??
      readString(raw.actor_avatar_url) ??
      readNestedString(actor, 'avatar_url') ??
      null,
    detail: buildDetail(raw, type),
    timestamp,
  };
}

function getEventsFromResponse(response: ActivityApiResponse): RawActivityEvent[] {
  if (Array.isArray(response)) return response;
  return response.items ?? response.events ?? response.activity ?? response.data ?? [];
}

export async function getActivityEvents(params: ActivityListParams = {}): Promise<ActivityEvent[]> {
  const response = await apiClient<ActivityApiResponse>('/api/activity', {
    params: { limit: params.limit ?? 8 },
  });
  return getEventsFromResponse(response).map(normalizeActivityEvent);
}
