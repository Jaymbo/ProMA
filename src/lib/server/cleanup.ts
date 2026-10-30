import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import db from '#lib/server/db';
import { UPLOAD_DIR } from '#lib/server/reports';

const RETENTION_DAYS = 30;

/** Dateien sicher löschen (fehlende Datei ignorieren) */
function removeUpload(path: string | null): void {
  if (!path) return;
  try {
    // Pfad-Traversal verhindern: nur direkte Dateinamen in UPLOAD_DIR
    if (path.includes('/') || path.includes('\\')) return;
    unlinkSync(join(UPLOAD_DIR, path));
  } catch {
    // Datei existiert evtl. nicht – ignorieren
  }
}

/**
 * Auto-Löschung: Erledigte Meldungen (resolved_at > 30 Tage) samt
 * Bildern und abhängigen Votes/Flags (ON DELETE CASCADE) löschen.
 * Gibt die Anzahl der gelöschten Meldungen zurück.
 */
export function cleanupResolvedReports(): number {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  const expired = db
    .prepare(
      'SELECT id, image_path, resolve_image_path FROM reports WHERE resolved = 1 AND resolved_at IS NOT NULL AND resolved_at < ?'
    )
    .all(cutoff) as Array<{
    id: number;
    image_path: string;
    resolve_image_path: string | null;
  }>;

  if (expired.length === 0) return 0;

  for (const r of expired) {
    removeUpload(r.image_path);
    removeUpload(r.resolve_image_path);
  }

  // Votes/Flags/Resolve-Votes via ON DELETE CASCADE mitgelöscht
  const result = db
    .prepare(
      'DELETE FROM reports WHERE resolved = 1 AND resolved_at IS NOT NULL AND resolved_at < ?'
    )
    .run(cutoff);

  return Number(result.changes);
}
