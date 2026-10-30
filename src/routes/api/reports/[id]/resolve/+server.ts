import type { RequestHandler } from './$types';
import db, { getIpHash } from '#lib/server/db';
import { checkRateLimit, getClientIp, saveImage, validateImage } from '#lib/server/reports';

/**
 * Erledigt-Meldung: Erledigt-Foto hochladen + Vote "stimmt, ist erledigt".
 * Body: multipart/form-data {image?: File, client_id: string} ODER JSON {client_id: string}
 * Ohne Foto = Bestätigungs-Vote für ein bereits hochgeladenes Erledigt-Foto.
 */
export const POST: RequestHandler = async ({ request, params }) => {
  const reportId = Number(params.id);
  if (!Number.isInteger(reportId)) return new Response('Ungültige ID', { status: 400 });

  const report = db
    .prepare('SELECT id, resolved, resolve_image_path FROM reports WHERE id = ? AND hidden = 0')
    .get(reportId) as
    | { id: number; resolved: number; resolve_image_path: string | null }
    | undefined;
  if (!report) return new Response('Meldung nicht gefunden', { status: 404 });
  if (report.resolved) return Response.json({ ok: true, alreadyResolved: true });

  const contentType = request.headers.get('content-type') ?? '';
  let clientId: string;
  let image: FormDataEntryValue | null = null;

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    clientId = String(form.get('client_id') ?? '').trim();
    image = form.get('image');
  } else {
    try {
      const body = (await request.json()) as { client_id?: string };
      clientId = String(body.client_id ?? '').trim();
    } catch {
      return new Response('Ungültiger Request-Body', { status: 400 });
    }
  }

  if (!clientId || clientId.length > 64 || !/^[a-zA-Z0-9-]+$/.test(clientId)) {
    return new Response('client_id fehlt oder ungültig', { status: 400 });
  }

  const ipHash = getIpHash(getClientIp(request));
  if (!checkRateLimit(ipHash, 'resolve', 20)) {
    return new Response('Zu viele Aktionen. Bitte warte einen Moment.', { status: 429 });
  }

  let resolveImagePath = report.resolve_image_path;

  // Fall 1: Erledigt-Foto hochladen (erster Schritt)
  if (image instanceof File && image.size > 0) {
    const imageError = validateImage(image);
    if (imageError) return new Response(imageError, { status: 400 });
    resolveImagePath = await saveImage(image, 'resolve');
    db.prepare('UPDATE reports SET resolve_image_path = ? WHERE id = ?').run(resolveImagePath, reportId);
    // Wer das Foto hochlädt, bestätigt automatisch mit
    db.prepare(
      `INSERT INTO resolve_votes (report_id, client_id, ip_hash, resolve_image_path)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (report_id, client_id, ip_hash) DO NOTHING`
    ).run(reportId, clientId, ipHash);
  } else if (!resolveImagePath) {
    return new Response('Erst ein Erledigt-Foto hochladen, dann bestätigen.', { status: 400 });
  } else {
    // Fall 2: Bestätigungs-Vote für existierendes Erledigt-Foto
    db.prepare(
      `INSERT INTO resolve_votes (report_id, client_id, ip_hash, resolve_image_path)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (report_id, client_id, ip_hash) DO NOTHING`
    ).run(reportId, clientId, ipHash);
  }

  const confirmations = (
    db.prepare('SELECT COUNT(*) AS n FROM resolve_votes WHERE report_id = ?').get(reportId) as {
      n: number;
    }
  ).n;

  // Schwellwert: 3 Bestätigungen => erledigt (konfigurierbar)
  const RESOLVE_THRESHOLD = 3;
  if (confirmations >= RESOLVE_THRESHOLD) {
    db.prepare("UPDATE reports SET resolved = 1, resolved_at = datetime('now') WHERE id = ?").run(reportId);
  }

  return Response.json({
    ok: true,
    confirmations,
    threshold: RESOLVE_THRESHOLD,
    resolved: confirmations >= RESOLVE_THRESHOLD
  });
};
