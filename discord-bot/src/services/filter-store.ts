/**
 * SQLite-backed filter store for per-user notification preferences.
 *
 * Each user can set filters on: category, min_tier, max_tier, min_reward.
 * Filters are AND-combined: a bounty must match ALL set filters to notify.
 */

import Database from 'better-sqlite3';
import path from 'path';

export interface UserFilter {
  user_id: string;
  guild_id: string;
  category: string | null;
  min_tier: number | null;
  max_tier: number | null;
  min_reward: number | null;
}

let db: Database.Database;

export function initDB(dbPath?: string): void {
  const resolved = dbPath ?? path.resolve(process.env.DB_PATH ?? './data/filters.db');
  db = new Database(resolved);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_filters (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      category TEXT,
      min_tier INTEGER,
      max_tier INTEGER,
      min_reward INTEGER,
      PRIMARY KEY (user_id, guild_id)
    );
  `);
}

function getDB(): Database.Database {
  if (!db) initDB();
  return db;
}

export function getFilter(userId: string, guildId: string): UserFilter | null {
  return getDB().prepare('SELECT * FROM user_filters WHERE user_id = ? AND guild_id = ?').get(userId, guildId) as UserFilter | null;
}

export function setFilter(userId: string, guildId: string, updates: Partial<Omit<UserFilter, 'user_id' | 'guild_id'>>): UserFilter {
  const existing = getFilter(userId, guildId);
  const merged = {
    category: updates.category ?? existing?.category ?? null,
    min_tier: updates.min_tier ?? existing?.min_tier ?? null,
    max_tier: updates.max_tier ?? existing?.max_tier ?? null,
    min_reward: updates.min_reward ?? existing?.min_reward ?? null,
  };
  getDB().prepare(`
    INSERT INTO user_filters (user_id, guild_id, category, min_tier, max_tier, min_reward)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, guild_id) DO UPDATE SET
      category = excluded.category,
      min_tier = excluded.min_tier,
      max_tier = excluded.max_tier,
      min_reward = excluded.min_reward
  `).run(userId, guildId, merged.category, merged.min_tier, merged.max_tier, merged.min_reward);
  return { user_id: userId, guild_id: guildId, ...merged };
}

export function clearFilter(userId: string, guildId: string): boolean {
  const result = getDB().prepare('DELETE FROM user_filters WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
  return result.changes > 0;
}

export function getAllFilters(guildId: string): UserFilter[] {
  return getDB().prepare('SELECT * FROM user_filters WHERE guild_id = ?').all(guildId) as UserFilter[];
}

/**
 * Check if a bounty matches a user's filters.
 * Returns true if the bounty passes all set filters (or if no filters exist).
 */
export function matchesFilter(filter: UserFilter | null, bounty: {
  category: string | null;
  tier: number;
  reward_amount: number;
}): boolean {
  if (!filter) return true; // no filter = accept all
  if (filter.category && bounty.category?.toLowerCase() !== filter.category.toLowerCase()) return false;
  if (filter.min_tier && bounty.tier < filter.min_tier) return false;
  if (filter.max_tier && bounty.tier > filter.max_tier) return false;
  if (filter.min_reward && bounty.reward_amount < filter.min_reward) return false;
  return true;
}