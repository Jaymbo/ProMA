import type { RequestHandler } from './$types';
import db, { getIpHash } from '#lib/server/db';
import { checkRateLimit, getClientIp } from '#lib/server/reports';

/**
 * Meldung flaggen (Community-Sicherheitsnetz): {client_id, reason?}
 * Bei >= 3 Flags wird die Meldung ausgeblendet (hidden = 1).
 */
export const POST: RequestHandler = async ({ request, params }) => {
  const reportId = Number(params.id);
  if (!Number.isInteger(reportId)) return new Response('Ungültige ID', { status: 400 });

  let body: { client_id?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Ungültiger Request-Body', { status: 400 });
  }

  const clientId = String(body.client_id ?? '').trim();
  const reason = String(body.reason ?? '').slice(0, 500);
  if (!clientId || clientId.length > 64 || !/^[a-zA-Z0-9-]+$/.test(clientId)) {
    return new Response('client_id fehlt oder ungültig', { status: 400 });
  }

  const report = db.prepare('SELECT id FROM reports WHERE id = ? AND hidden = 0').get(reportId);
  if (!report) return new Response('Meldung nicht gefunden', { status: 404 });

  const ipHash = getIpHash(getClientIp(request));
  if (!checkRateLimit(ipHash, 'flag', 10)) {
    return new Response('Zu viele Aktionen. Bitte warte einen Moment.', { status: 429 });
  }

  const result = db
    .prepare(
      `INSERT INTO flags (report_id, client_id, reason) VALUES (?, ?, ?)
       ON CONFLICT (report_id, client_id) DO NOTHING`
    )
    .run(reportId, clientId, reason);

  if (result.changes === 0) {
    return Response.json({ ok: true, alreadyFlagged: true });
  }

  db.prepare('UPDATE reports SET flags = flags + 1 WHERE id = ?').run(reportId);

  const flags = (db.prepare('SELECT flags FROM reports WHERE id = ?').get(reportId) as { flags: number }).flags;
  const FLAG_THRESHOLD = 3;
  let hidden = false;
  if (flags >= FLAG_THRESHOLD) {
    db.prepare('UPDATE reports SET hidden = 1 WHERE id = ?').run(reportId);
    hidden = true;
  }

  return Response.json({ ok: true, flags, hidden });
};
