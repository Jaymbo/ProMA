import type { RequestHandler } from './$types';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

/** Statische Auslieferung der hochgeladenen Bilder (data/uploads) */
export const GET: RequestHandler = async ({ params }) => {
  const filename = params.file;
  // Pfad-Traversal verhindern: nur einfache Dateinamen erlauben
  if (!/^[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$/.test(filename)) {
    return new Response('Ungültiger Dateiname', { status: 400 });
  }
  const path = join(UPLOAD_DIR, filename);
  if (!existsSync(path)) return new Response('Nicht gefunden', { status: 404 });

  const ext = filename.split('.').pop() as string;
  return new Response(readFileSync(path), {
    headers: {
      'Content-Type': MIME[ext],
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
};
