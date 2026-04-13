import Database from 'better-sqlite3';
import { join } from 'path';
import type { BountyState } from '../types/index.js';

export class StateStore {
  private db: Database.Database;

  constructor(dbPath = join(process.cwd(), 'bounty-hunter.db')) {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS states (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        plan_json TEXT,
        last_error TEXT,
        attempts INTEGER DEFAULT 0,
        pr_url TEXT,
        created_at TEXT,
        updated_at TEXT,
        bounty_json TEXT NOT NULL
      )
    `);
  }

  save(state: BountyState): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO states (id,status,plan_json,last_error,attempts,pr_url,created_at,updated_at,bounty_json)
      VALUES (?,?,?,?,?,?,?,?,?)
    `);
    stmt.run(
      state.id, state.status,
      state.plan ? JSON.stringify(state.plan) : null,
      state.lastError || null,
      state.attempts,
      state.prUrl || null,
      state.createdAt, state.updatedAt,
      JSON.stringify(state.bounty),
    );
  }

  get(id: string): BountyState | null {
    const row = this.db.prepare('SELECT * FROM states WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id, status: row.status,
      plan: row.plan_json ? JSON.parse(row.plan_json) : undefined,
      lastError: row.last_error, attempts: row.attempts,
      prUrl: row.pr_url, createdAt: row.created_at, updatedAt: row.updated_at,
      bounty: JSON.parse(row.bounty_json),
    };
  }

  hasCompleted(id: string): boolean {
    const row = this.db.prepare('SELECT status FROM states WHERE id = ?').get(id) as any;
    return row?.status === 'done';
  }

  close(): void {
    this.db.close();
  }
}
