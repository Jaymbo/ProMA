import type { RequestHandler } from './$types';
import db, { getIpHash } from '#lib/server/db';
import { checkRateLimit, getClientIp } from '#lib/server/reports';

/** Vote abgeben: {value: 1 | -1, client_id: <localStorage-UUID>} */
export const POST: RequestHandler = async ({ request, params }) => {
  const reportId = Number(params.id);
  if (!Number.isInteger(reportId)) {
    return new Response('Ungültige ID', { status: 400 });
  }

  let body: { value?: number; client_id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Ungültiger Request-Body', { status: 400 });
  }

  const value = Number(body.value);
  const clientId = String(body.client_id ?? '').trim();
  if (value !== 1 && value !== -1) {
    return new Response('value muss 1 oder -1 sein', { status: 400 });
  }
  if (!clientId || clientId.length > 64 || !/^[a-zA-Z0-9-]+$/.test(clientId)) {
    return new Response('client_id fehlt oder ungültig', { status: 400 });
  }

  const report = db.prepare('SELECT id FROM reports WHERE id = ? AND hidden = 0').get(reportId);
  if (!report) return new Response('Meldung nicht gefunden', { status: 404 });

  const ipHash = getIpHash(getClientIp(request));
  if (!checkRateLimit(ipHash, 'vote', 20)) {
    return new Response('Zu viele Votes. Bitte warte einen Moment.', { status: 429 });
  }

  // Upsert: bestehenden Vote ersetzen (Stimmen-Änderung erlaubt, aber nur 1 Stimme)
  const existing = db
    .prepare('SELECT value FROM votes WHERE report_id = ? AND client_id = ? AND ip_hash = ?')
    .get(reportId, clientId, ipHash) as { value: number } | undefined;

  const tx = db.prepare('UPDATE reports SET upvotes = upvotes + ?, downvotes = downvotes + ? WHERE id = ?');
  if (existing) {
    if (existing.value === value) {
      return Response.json({ ok: true, changed: false });
    }
    // Alte Stimme zurücknehmen, neue zählen
    tx.run(value === 1 ? 1 : 0, value === -1 ? 1 : 0, reportId);
    db.prepare('UPDATE reports SET upvotes = upvotes - ?, downvotes = downvotes - ? WHERE id = ?').run(
      existing.value === 1 ? 1 : 0,
      existing.value === -1 ? 1 : 0,
      reportId
    );
    db.prepare(
      'UPDATE votes SET value = ?, created_at = datetime(\'now\') WHERE report_id = ? AND client_id = ? AND ip_hash = ?'
    ).run(value, reportId, clientId, ipHash);
  } else {
    tx.run(value === 1 ? 1 : 0, value === -1 ? 1 : 0, reportId);
    db.prepare(
      'INSERT INTO votes (report_id, client_id, ip_hash, value) VALUES (?, ?, ?, ?)'
    ).run(reportId, clientId, ipHash, value);
  }

  const updated = db
    .prepare('SELECT upvotes, downvotes FROM reports WHERE id = ?')
    .get(reportId) as { upvotes: number; downvotes: number };
  return Response.json({ ok: true, changed: true, ...updated });
};
