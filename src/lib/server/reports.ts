import crypto from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import db, { getIpHash } from '#lib/server/db';

export const UPLOAD_DIR = join(process.cwd(), 'uploads');
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return '127.0.0.1';
}

/** Rate-Limit: max N Aktionen pro Minute pro IP-Hash */
export function checkRateLimit(ipHash: string, action: string, maxPerMinute: number): boolean {
  const window = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  const row = db
    .prepare('SELECT count FROM rate_limit WHERE ip_hash = ? AND action = ? AND window = ?')
    .get(ipHash, action, window) as { count: number } | undefined;
  if (row && row.count >= maxPerMinute) return false;
  db.prepare(
    `INSERT INTO rate_limit (ip_hash, action, window, count) VALUES (?, ?, ?, 1)
     ON CONFLICT (ip_hash, action, window) DO UPDATE SET count = count + 1`
  ).run(ipHash, action, window);
  return true;
}

export async function saveImage(file: File, prefix: string): Promise<string> {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const name = `${prefix}-${crypto.randomUUID()}.${ext}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  mkdirSync(UPLOAD_DIR, { recursive: true });
  writeFileSync(join(UPLOAD_DIR, name), buf);
  return name;
}

export function validateImage(image: unknown): string | null {
  if (!(image instanceof File) || image.size === 0) return 'Foto fehlt';
  if (image.size > MAX_IMAGE_BYTES) return 'Foto zu groß (max. 8 MB)';
  if (!ALLOWED_TYPES.has(image.type)) return 'Nur JPEG/PNG/WebP erlaubt';
  return null;
}

/** Serverseitige Regel-Prüfung als Fallback zur Client-KI (Text) */
const BLOCKED_PATTERNS = [
  // Personenbezug / Verpetzung
  /\b(kennzeichen|kennz\.|nummernschild|fahrers?|personen?|leute|bewohner|nachbar[n]?|mieter|anwohner)\b/i,
  // Beleidigungen (kleiner Auszug)
  /\b(idiot|dumm|verdamm|scheiß|hurensohn|arschloch|wichser)\b/i,
  // Namen-Muster ("Herr X", "Frau Y")
  /\b(herr|frau)\s+[A-ZÄÖÜ][a-zäöüß]+/
];

export function checkText(title: string, description: string): { ok: boolean; reason?: string } {
  const text = `${title} ${description}`;
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        ok: false,
        reason:
          'Die Meldung scheint personenbezogene Inhalte oder unangemessene Sprache zu enthalten. Bitte keine Personen beschreiben oder verpetzen.'
      };
    }
  }
  if (description.length < 10) {
    return {
      ok: false,
      reason: 'Bitte beschreibe das Problem etwas ausführlicher (min. 10 Zeichen).'
    };
  }
  if (title.length === 0 || title.length > 120) {
    return { ok: false, reason: 'Titel fehlt oder zu lang (max. 120 Zeichen).' };
  }
  return { ok: true };
}

/** Wichtigkeits-Score: (Upvotes − Downvotes) × 2 − Alter_in_Tagen × 0.5, min. 0 */
export function importanceScore(upvotes: number, downvotes: number, createdAt: string): number {
  const ageDays = (Date.now() - new Date(createdAt + 'Z').getTime()) / 86400000;
  return Math.max(0, (upvotes - downvotes) * 2 - ageDays * 0.5);
}
