import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(process.cwd(), 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(join(DATA_DIR, 'proma.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS reports (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT    NOT NULL,
    description   TEXT    NOT NULL,
    image_path    TEXT    NOT NULL,
    lat           REAL    NOT NULL,
    lon           REAL    NOT NULL,
    upvotes       INTEGER NOT NULL DEFAULT 0,
    downvotes     INTEGER NOT NULL DEFAULT 0,
    resolved      INTEGER NOT NULL DEFAULT 0,
    resolved_at   TEXT,
    resolve_image_path TEXT,
    flags         INTEGER NOT NULL DEFAULT 0,
    hidden        INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS votes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id  INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    client_id  TEXT    NOT NULL,
    ip_hash    TEXT    NOT NULL,
    value      INTEGER NOT NULL CHECK (value IN (1, -1)),
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (report_id, client_id, ip_hash)
  );

  CREATE TABLE IF NOT EXISTS resolve_votes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id   INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    client_id   TEXT    NOT NULL,
    ip_hash     TEXT    NOT NULL,
    resolve_image_path TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (report_id, client_id, ip_hash)
  );

  CREATE TABLE IF NOT EXISTS flags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id  INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    client_id  TEXT    NOT NULL,
    reason     TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (report_id, client_id)
  );

  CREATE TABLE IF NOT EXISTS rate_limit (
    ip_hash    TEXT NOT NULL,
    action     TEXT NOT NULL,
    window     TEXT NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (ip_hash, action, window)
  );

  CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
  CREATE INDEX IF NOT EXISTS idx_votes_report ON votes(report_id);
`);

// Migration: area-Spalte entfernen (Standort jetzt nur via Karte/GPS-Koordinaten)
try {
  // Wichtig: Index VOR der Spalte löschen, sonst schlägt DROP COLUMN fehl
  db.exec('DROP INDEX IF EXISTS idx_reports_area');
  db.exec('ALTER TABLE reports DROP COLUMN area');
} catch {
  // Spalte existiert nicht mehr – nichts zu tun
}

import crypto from 'node:crypto';

/** Daily-rotating salt für IP-Hashing (Roh-IP wird nie gespeichert) */
function dailySalt(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

let saltCache = '';
export function getIpHash(ip: string): string {
  if (!saltCache) saltCache = dailySalt();
  return crypto.createHash('sha256').update(`${saltCache}:${ip}`).digest('hex');
}

export default db;
