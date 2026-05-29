import { apiClient } from '../services/apiClient';
import type { ActivityEvent, ActivityEventType } from '../types/activity';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function normalizeType(value: unknown): ActivityEventType {
  const raw = (asString(value) ?? '').toLowerCase();

  if (raw.includes('payout') || raw.includes('released') || raw.includes('paid')) {
    return 'payout';
  }
  if (raw.includes('review') || raw.includes('score')) {
    return 'review';
  }
  if (raw.includes('submit') || raw.includes('pull_request') || raw.includes('pr_')) {
    return 'submitted';
  }
  if (raw.includes('post') || raw.includes('created') || raw.includes('publish')) {
    return 'posted';
  }
  if (raw.includes('complete') || raw.includes('approve') || raw.includes('win')) {
    return 'completed';
  }

  return 'posted';
}

function normalizeTimestamp(record: UnknownRecord): string {
  return (
    asString(record.timestamp) ??
    asString(record.created_at) ??
    asString(record.createdAt) ??
    asString(record.block_time) ??
    asString(record.blockTime) ??
    new Date().toISOString()
  );
}

function normalizeUsername(record: UnknownRecord): string {
  return (
    asString(record.username) ??
    asString(record.user_name) ??
    asString(record.actor) ??
    asString(record.actor_username) ??
    asString(record.creator_username) ??
    asString(record.contributor_username) ??
    asString(record.org_name) ??
    'Unknown'
  );
}

function normalizeDetail(record: UnknownRecord): string {
  return (
    asString(record.detail) ??
    asString(record.message) ??
    asString(record.description) ??
    asString(record.title) ??
    asString(record.summary) ??
    'Recent platform activity'
  );
}

function normalizeAvatar(record: UnknownRecord): string | null {
  return (
    asString(record.avatar_url) ??
    asString(record.avatarUrl) ??
    asString(record.user_avatar) ??
    asString(record.actor_avatar_url)
  );
}

function normalizeId(record: UnknownRecord, index: number): string {
  return (
    asString(record.id) ??
    asString(record.event_id) ??
    asString(record.tx_signature) ??
    asString(record.transaction_signature) ??
    `${normalizeType(record.type ?? record.event_type)}-${normalizeTimestamp(record)}-${index}`
  );
}

function normalizeEvent(value: unknown, index: number): ActivityEvent | null {
  const record = asRecord(value);
  if (!record) return null;

  return {
    id: normalizeId(record, index),
    type: normalizeType(record.type ?? record.event_type ?? record.kind ?? record.status),
    username: normalizeUsername(record),
    avatar_url: normalizeAvatar(record),
    detail: normalizeDetail(record),
    timestamp: normalizeTimestamp(record),
  };
}

function extractItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const record = asRecord(payload);
  if (!record) return [];

  const nested =
    record.events ??
    record.items ??
    record.data ??
    record.results ??
    record.activity;

  return Array.isArray(nested) ? nested : [];
}

export function normalizeActivityFeed(payload: unknown): ActivityEvent[] {
  return extractItems(payload)
    .map(normalizeEvent)
    .filter((event): event is ActivityEvent => event !== null)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
}

export async function getActivityFeed(): Promise<ActivityEvent[]> {
  const response = await apiClient<unknown>('/api/activity');
  return normalizeActivityFeed(response);
}
