import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Subscriber } from './types';

const DB_PATH = process.env.DB_PATH || './data/subscribers.db';

let db: Database.Database;

export function initStorage(): void {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL UNIQUE,
      username TEXT,
      filters TEXT DEFAULT '',
      subscribed_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

export function addSubscriber(chatId: number, username?: string): boolean {
  try {
    db.prepare('INSERT OR IGNORE INTO subscribers (chat_id, username) VALUES (?, ?)').run(chatId, username || null);
    return true;
  } catch { return false; }
}

export function removeSubscriber(chatId: number): boolean {
  const r = db.prepare('DELETE FROM subscribers WHERE chat_id = ?').run(chatId);
  return r.changes > 0;
}

export function isSubscribed(chatId: number): boolean {
  const row = db.prepare('SELECT 1 FROM subscribers WHERE chat_id = ?').get(chatId);
  return !!row;
}

export function getSubscriber(chatId: number): Subscriber | undefined {
  return db.prepare('SELECT * FROM subscribers WHERE chat_id = ?').get(chatId) as Subscriber | undefined;
}

export function getAllSubscribers(): Subscriber[] {
  return db.prepare('SELECT * FROM subscribers').all() as Subscriber[];
}

export function setFilters(chatId: number, filters: string): void {
  db.prepare('UPDATE subscribers SET filters = ? WHERE chat_id = ?').run(filters, chatId);
}

export function closeStorage(): void {
  db?.close();
}
