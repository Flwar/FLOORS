import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const SESSION_DAYS = 30;

/**
 * Accounts, sessions and characters in SQLite (Node's built-in driver).
 * Writes are synchronous, so a save completes before the next tick runs.
 */
export class Db {
  private db: DatabaseSync;

  constructor(path = process.env.FLOORS_DB ?? "data/floors.db") {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        hash BLOB NOT NULL,
        salt BLOB NOT NULL,
        created INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL,
        expires INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS characters (
        account_id INTEGER PRIMARY KEY,
        data TEXT NOT NULL,
        updated INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS world (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  createAccount(username: string, password: string): { id: number } | { error: string } {
    if (!/^[\p{L}\p{N}_-]{3,16}$/u.test(username)) return { error: "Names are 3–16 letters, numbers, - or _." };
    if (password.length < 6 || password.length > 128) return { error: "Passwords need at least 6 characters." };
    const exists = this.db.prepare("SELECT id FROM accounts WHERE username = ?").get(username);
    if (exists) return { error: "That name is taken." };
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 64);
    const res = this.db.prepare("INSERT INTO accounts (username, hash, salt, created) VALUES (?, ?, ?, ?)").run(username, hash, salt, Date.now());
    return { id: Number(res.lastInsertRowid) };
  }

  verify(username: string, password: string): { id: number; username: string } | undefined {
    const row = this.db.prepare("SELECT id, username, hash, salt FROM accounts WHERE username = ?").get(username) as
      | { id: number; username: string; hash: Uint8Array; salt: Uint8Array }
      | undefined;
    if (!row) {
      scryptSync(password, "timing-equaliser", 64);
      return undefined;
    }
    const hash = scryptSync(password, Buffer.from(row.salt), 64);
    return timingSafeEqual(hash, Buffer.from(row.hash)) ? { id: row.id, username: row.username } : undefined;
  }

  createSession(accountId: number): string {
    const token = randomBytes(24).toString("base64url");
    this.db.prepare("INSERT INTO sessions (token, account_id, expires) VALUES (?, ?, ?)").run(token, accountId, Date.now() + SESSION_DAYS * 864e5);
    this.db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
    return token;
  }

  sessionAccount(token: string): { id: number; username: string } | undefined {
    const row = this.db.prepare("SELECT a.id, a.username FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token = ? AND s.expires > ?").get(token, Date.now()) as
      | { id: number; username: string }
      | undefined;
    return row;
  }

  endSession(token: string) {
    this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }

  loadCharacter<T>(accountId: number): T | undefined {
    const row = this.db.prepare("SELECT data FROM characters WHERE account_id = ?").get(accountId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as T) : undefined;
  }

  saveCharacter(accountId: number, data: unknown) {
    this.db.prepare("INSERT INTO characters (account_id, data, updated) VALUES (?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET data = excluded.data, updated = excluded.updated").run(accountId, JSON.stringify(data), Date.now());
  }

  getWorld<T>(key: string): T | undefined {
    const row = this.db.prepare("SELECT value FROM world WHERE key = ?").get(key) as { value: string } | undefined;
    return row ? (JSON.parse(row.value) as T) : undefined;
  }

  setWorld(key: string, value: unknown) {
    this.db.prepare("INSERT INTO world (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(value));
  }
}

export const db = new Db();
