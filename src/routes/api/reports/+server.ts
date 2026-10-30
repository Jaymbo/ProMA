import type { RequestHandler } from './$types';
import db, { getIpHash } from '#lib/server/db';
import type { ReportDto } from '#lib/shared/types';
import {
  checkRateLimit,
  checkText,
  getClientIp,
  importanceScore,
  saveImage,
  validateImage
} from '#lib/server/reports';

// ReportDto kommt aus #lib/shared/types

export const GET: RequestHandler = async ({ url }) => {
  const sort = url.searchParams.get('sort') ?? 'score';
  const resolvedParam = url.searchParams.get('resolved'); // 'false' => nur offene
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 200);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  const where = ['hidden = 0'];
  const params: (string | number)[] = [];
  if (resolvedParam === 'false') where.push('resolved = 0');

  const orderBy =
    sort === 'new'
      ? 'created_at DESC'
      : sort === 'votes'
        ? 'upvotes DESC, downvotes ASC'
        : // score (berechnet in SQL analog zu importanceScore)
          `MAX(0, (upvotes - downvotes) * 2 - (julianday('now') - julianday(created_at)) * 0.5) DESC, created_at DESC`;

  params.push(limit, offset);
  const rows = db
    .prepare(
      `SELECT id, title, description, image_path, lat, lon, upvotes, downvotes,
              resolved, flags, created_at
       FROM reports WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(...params) as Array<Record<string, unknown>>;

  const reports: ReportDto[] = rows.map((r) => ({
    id: r.id as number,
    title: r.title as string,
    description: r.description as string,
    image: `/uploads/${r.image_path}`,
    lat: r.lat as number,
    lon: r.lon as number,
    upvotes: r.upvotes as number,
    downvotes: r.downvotes as number,
    score: importanceScore(r.upvotes as number, r.downvotes as number, r.created_at as string),
    resolved: Boolean(r.resolved),
    flags: r.flags as number,
    created_at: r.created_at as string
  }));

  return Response.json({ ok: true, reports });
};

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const lat = Number(form.get('lat'));
  const lon = Number(form.get('lon'));
  const image = form.get('image');

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    return new Response('Ungültige Koordinaten', { status: 400 });
  }
  const imageError = validateImage(image);
  if (imageError) return new Response(imageError, { status: 400 });

  const textCheck = checkText(title, description);
  if (!textCheck.ok) {
    return Response.json({ ok: false, reason: textCheck.reason }, { status: 422 });
  }

  const ipHash = getIpHash(getClientIp(request));
  if (!checkRateLimit(ipHash, 'create', 5)) {
    return new Response('Zu viele Meldungen. Bitte warte einen Moment.', { status: 429 });
  }

  const imagePath = await saveImage(image as File, 'report');
  const result = db
    .prepare(
      `INSERT INTO reports (title, description, image_path, lat, lon)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(title, description, imagePath, lat, lon);

  return Response.json({ ok: true, id: Number(result.lastInsertRowid) }, { status: 201 });
};
