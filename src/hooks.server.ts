import type { Handle } from '@sveltejs/kit/hooks';
import { cleanupResolvedReports } from '#lib/server/cleanup';

// Auto-Löschung max. 1× pro Stunde ausführen
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastRun = 0;

export const handle: Handle = async ({ event, resolve }) => {
  if (Date.now() - lastRun > CLEANUP_INTERVAL_MS) {
    lastRun = Date.now();
    try {
      cleanupResolvedReports();
    } catch (err) {
      console.error('Cleanup fehlgeschlagen:', err);
    }
  }
  return resolve(event);
};
