/**
 * API de Pelote — une seule Pages Function qui route toutes les requêtes /api/*.
 *
 * Authentification : Cloudflare Access est placé devant l'app. Chaque requête
 * porte un JWT (en-tête Cf-Access-Jwt-Assertion) que l'on vérifie ici avec les
 * clés publiques de l'équipe Access. En local, sans Access, on utilise DEV_USER
 * (défini dans .dev.vars, jamais déployé).
 */

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  DEV_USER?: string;
}

type Ctx = { req: Request; env: Env; user: string; url: URL; params: string[] };
type Handler = (c: Ctx) => Promise<Response>;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const bad = (msg: string, status = 400) => json({ error: msg }, status);
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
/** Accepts an ISO date or datetime and returns SQLite's "YYYY-MM-DD HH:MM:SS" (UTC) form, to compare with created_at. */
const sqlTime = (s: string | null) => {
  if (!s) return '1970-01-01 00:00:00';
  const d = new Date(s.length === 10 ? s + 'T00:00:00Z' : s);
  return isNaN(d.getTime()) ? '1970-01-01 00:00:00' : d.toISOString().slice(0, 19).replace('T', ' ');
};

/* ---------------------------------------------------------------- auth -- */

type Jwk = JsonWebKey & { kid: string };
let certCache: { at: number; keys: Jwk[] } | null = null;

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

async function accessKeys(team: string): Promise<Jwk[]> {
  if (certCache && Date.now() - certCache.at < 10 * 60 * 1000) return certCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('certs');
  const body = (await res.json()) as { keys: Jwk[] };
  certCache = { at: Date.now(), keys: body.keys };
  return body.keys;
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

async function verifyAccess(req: Request, env: Env): Promise<string | null> {
  const token = req.headers.get('cf-access-jwt-assertion') || readCookie(req, 'CF_Authorization');
  if (!token) return null;
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h))) as { kid: string; alg: string };
  if (header.alg !== 'RS256') return null;
  const jwk = (await accessKeys(env.ACCESS_TEAM_DOMAIN!)).find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))) as {
    email?: string; aud?: string | string[]; exp?: number; iss?: string;
  };
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(env.ACCESS_AUD)) return null;
  if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
  if (payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return null;
  return payload.email?.toLowerCase() ?? null;
}

async function currentUser(req: Request, env: Env): Promise<string | null> {
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) return verifyAccess(req, env);
  return env.DEV_USER || null; // dev local uniquement
}

async function userHash(email: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* -------------------------------------------------------------- helpers -- */

async function body<T>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { return {} as T; }
}

/** Builds "SET a = ?, b = ?" from an object, keeping only allowed columns. */
function patchSql(input: Record<string, unknown>, allowed: string[]) {
  const cols = Object.keys(input).filter((k) => allowed.includes(k));
  return { sql: cols.map((c) => `${c} = ?`).join(', '), values: cols.map((c) => input[c] ?? null) };
}

async function ensureUser(env: Env, email: string) {
  await env.DB.prepare('INSERT OR IGNORE INTO users (email) VALUES (?)').bind(email).run();
  return env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
}

/* --------------------------------------------------------------- routes -- */

const routes: Array<[string, RegExp, Handler]> = [];
const on = (method: string, pattern: string, h: Handler) =>
  routes.push([method, new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$'), h]);

// Profil -------------------------------------------------------------------
on('GET', '/api/me', async ({ env, user }) => {
  const me = await ensureUser(env, user);
  const fil = await env.DB.prepare('SELECT * FROM fil WHERE user = ?').bind(user).first();
  return json({ ...me, fil });
});

on('PUT', '/api/me', async ({ req, env, user }) => {
  await ensureUser(env, user);
  const { sql, values } = patchSql(await body(req), ['cat_name', 'cat_coat', 'checkin', 'recre', 'soir', 'onboarded']);
  if (sql) await env.DB.prepare(`UPDATE users SET ${sql} WHERE email = ?`).bind(...values, user).run();
  return json(await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(user).first());
});

on('GET', '/api/stats', async ({ env, user }) => {
  const one = (sql: string) => env.DB.prepare(sql).bind(user).first<{ n: number }>().then((r) => r?.n ?? 0);
  const me = await ensureUser(env, user) as { created_at: string };
  return json({
    done: await one('SELECT COUNT(*) n FROM tasks WHERE user = ? AND done = 1'),
    panier: await one('SELECT COUNT(*) n FROM panier WHERE user = ? AND archived = 0'),
    knots: await one('SELECT COUNT(*) n FROM knots WHERE user = ?'),
    thoughts: await one('SELECT COUNT(*) n FROM thoughts WHERE user = ?'),
    since: me.created_at,
  });
});

// Tâches -------------------------------------------------------------------
const TASK_COLS = ['title', 'due_date', 'due_time', 'minutes', 'tag', 'important', 'done', 'done_at', 'where_note', 'next_note'];

on('GET', '/api/tasks', async ({ env, user, url }) => {
  const since = url.searchParams.get('doneSince') || '1970-01-01';
  const { results } = await env.DB.prepare(
    `SELECT * FROM tasks WHERE user = ? AND (done = 0 OR done_at >= ?)
     ORDER BY done, COALESCE(due_date, '0000'), COALESCE(due_time, ''), created_at`,
  ).bind(user, since).all();
  return json(results);
});

on('POST', '/api/tasks', async ({ req, env, user }) => {
  const t = await body<Record<string, unknown>>(req);
  if (!t.title || typeof t.title !== 'string') return bad('title requis');
  const row = { id: id(), user, title: t.title.slice(0, 300), due_date: t.due_date ?? null, due_time: t.due_time ?? null,
    minutes: t.minutes ?? null, tag: t.tag ?? null, important: t.important ? 1 : 0 };
  await env.DB.prepare(
    'INSERT INTO tasks (id, user, title, due_date, due_time, minutes, tag, important) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(row.id, row.user, row.title, row.due_date, row.due_time, row.minutes, row.tag, row.important).run();
  return json(await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(row.id).first(), 201);
});

on('PATCH', '/api/tasks/:id', async ({ req, env, user, params }) => {
  const input = await body<Record<string, unknown>>(req);
  if ('done' in input) input.done_at = input.done ? now() : null;
  const { sql, values } = patchSql(input, TASK_COLS);
  if (!sql) return bad('rien à modifier');
  await env.DB.prepare(`UPDATE tasks SET ${sql} WHERE id = ? AND user = ?`).bind(...values, params[0], user).run();
  return json(await env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND user = ?').bind(params[0], user).first());
});

on('DELETE', '/api/tasks/:id', async ({ env, user, params }) => {
  await env.DB.prepare('DELETE FROM tasks WHERE id = ? AND user = ?').bind(params[0], user).run();
  return json({ ok: true });
});

// Le Fil et le Nœud ---------------------------------------------------------
on('PUT', '/api/fil', async ({ req, env, user }) => {
  const b = await body<{ task_id?: string; title: string; knot?: { where?: string; next?: string } }>(req);
  if (!b.title) return bad('title requis');
  const prev = await env.DB.prepare('SELECT * FROM fil WHERE user = ?').bind(user).first<{ task_id: string; title: string }>();
  const stmts = [];
  if (prev && b.knot) {
    stmts.push(env.DB.prepare(
      'INSERT INTO knots (id, user, from_title, to_title, where_note, next_note) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(id(), user, prev.title, b.title, b.knot.where ?? null, b.knot.next ?? null));
    if (prev.task_id) {
      stmts.push(env.DB.prepare('UPDATE tasks SET where_note = ?, next_note = ? WHERE id = ? AND user = ?')
        .bind(b.knot.where ?? null, b.knot.next ?? null, prev.task_id, user));
    }
  }
  stmts.push(env.DB.prepare(
    `INSERT INTO fil (user, task_id, title, started_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user) DO UPDATE SET task_id = excluded.task_id, title = excluded.title, started_at = excluded.started_at`,
  ).bind(user, b.task_id ?? null, b.title, now()));
  await env.DB.batch(stmts);
  return json(await env.DB.prepare('SELECT * FROM fil WHERE user = ?').bind(user).first());
});

on('DELETE', '/api/fil', async ({ env, user }) => {
  await env.DB.prepare('DELETE FROM fil WHERE user = ?').bind(user).run();
  return json({ ok: true });
});

// Pensées et rappels ---------------------------------------------------------
on('GET', '/api/thoughts', async ({ env, user, url }) => {
  const since = sqlTime(url.searchParams.get('since'));
  const { results: thoughts } = await env.DB.prepare(
    'SELECT * FROM thoughts WHERE user = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 200',
  ).bind(user, since).all();
  const { results: reminders } = await env.DB.prepare(
    'SELECT * FROM reminders WHERE user = ? AND created_at >= ?',
  ).bind(user, since).all();
  return json({ thoughts, reminders });
});

on('POST', '/api/thoughts', async ({ req, env, user }) => {
  const b = await body<{
    text: string; context?: string;
    reminders?: Array<{ label: string; due_date?: string; due_time?: string; remind_on: string }>;
    ideas?: string[];
  }>(req);
  if (!b.text?.trim()) return bad('text requis');
  const tid = id();
  const stmts = [env.DB.prepare('INSERT INTO thoughts (id, user, text) VALUES (?, ?, ?)').bind(tid, user, b.text.slice(0, 4000))];
  for (const r of b.reminders ?? []) {
    stmts.push(env.DB.prepare(
      'INSERT INTO reminders (id, user, thought_id, label, due_date, due_time, remind_on) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(id(), user, tid, r.label.slice(0, 200), r.due_date ?? null, r.due_time ?? null, r.remind_on));
  }
  for (const idea of b.ideas ?? []) {
    stmts.push(env.DB.prepare(
      "INSERT INTO panier (id, user, kind, title, body, tag, context) VALUES (?, ?, 'texte', ?, ?, 'Idées', ?)",
    ).bind(id(), user, idea.slice(0, 200), idea, b.context ?? 'depuis Pensées'));
  }
  await env.DB.batch(stmts);
  return json({ id: tid }, 201);
});

on('GET', '/api/reminders', async ({ env, user, url }) => {
  const day = url.searchParams.get('day');
  if (!day) return bad('day requis');
  const { results } = await env.DB.prepare(
    "SELECT * FROM reminders WHERE user = ? AND remind_on <= ? AND status != 'fait' ORDER BY created_at",
  ).bind(user, day).all();
  return json(results);
});

on('PATCH', '/api/reminders/:id', async ({ req, env, user, params }) => {
  const b = await body<{ status: 'fait' | 'demain' | 'soir'; remind_on?: string }>(req);
  const { sql, values } = patchSql(b as Record<string, unknown>, ['status', 'remind_on']);
  if (!sql) return bad('rien à modifier');
  await env.DB.prepare(`UPDATE reminders SET ${sql} WHERE id = ? AND user = ?`).bind(...values, params[0], user).run();
  return json({ ok: true });
});

// Le Panier ------------------------------------------------------------------
on('GET', '/api/panier', async ({ env, user }) => {
  const { results } = await env.DB.prepare(
    'SELECT * FROM panier WHERE user = ? AND archived = 0 ORDER BY created_at DESC LIMIT 500',
  ).bind(user).all();
  return json(results);
});

on('POST', '/api/panier', async ({ req, env, user }) => {
  const ct = req.headers.get('content-type') || '';
  let f: Record<string, string | null> = {};
  let imageKey: string | null = null;
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    for (const k of ['title', 'body', 'url', 'tag', 'why', 'context']) f[k] = (form.get(k) as string) || null;
    const file = form.get('image') as unknown as File | string | null;
    if (file && typeof file !== 'string') {
      if (file.size > 10 * 1024 * 1024) return bad('image trop lourde (10 Mo max)', 413);
      if (!file.type.startsWith('image/')) return bad('seules les images sont acceptées', 415);
      imageKey = `${await userHash(user)}/${id()}`;
      await env.BUCKET.put(imageKey, file.stream(), { httpMetadata: { contentType: file.type } });
    }
  } else {
    f = await body<Record<string, string | null>>(req);
  }
  const kind = imageKey ? 'image' : f.url ? 'lien' : 'texte';
  const title = (f.title || f.url || (f.body || '').slice(0, 80) || 'Capture').slice(0, 200);
  const rowId = id();
  await env.DB.prepare(
    'INSERT INTO panier (id, user, kind, title, body, url, image_key, tag, why, context) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(rowId, user, kind, title, f.body ?? null, f.url ?? null, imageKey, f.tag ?? null, f.why ?? null, f.context ?? null).run();
  return json(await env.DB.prepare('SELECT * FROM panier WHERE id = ?').bind(rowId).first(), 201);
});

on('PATCH', '/api/panier/:id', async ({ req, env, user, params }) => {
  const { sql, values } = patchSql(await body(req), ['title', 'tag', 'why', 'opened_at', 'archived']);
  if (!sql) return bad('rien à modifier');
  await env.DB.prepare(`UPDATE panier SET ${sql} WHERE id = ? AND user = ?`).bind(...values, params[0], user).run();
  return json({ ok: true });
});

on('DELETE', '/api/panier/:id', async ({ env, user, params }) => {
  const row = await env.DB.prepare('SELECT image_key FROM panier WHERE id = ? AND user = ?').bind(params[0], user).first<{ image_key: string | null }>();
  if (row?.image_key) await env.BUCKET.delete(row.image_key);
  await env.DB.prepare('DELETE FROM panier WHERE id = ? AND user = ?').bind(params[0], user).run();
  return json({ ok: true });
});

on('GET', '/api/files/:hash/:id', async ({ env, user, params }) => {
  if (params[0] !== (await userHash(user))) return bad('interdit', 403);
  const obj = await env.BUCKET.get(`${params[0]}/${params[1]}`);
  if (!obj) return bad('introuvable', 404);
  return new Response(obj.body, {
    headers: { 'content-type': obj.httpMetadata?.contentType || 'application/octet-stream', 'cache-control': 'private, max-age=86400' },
  });
});

// Humeur et énergie -----------------------------------------------------------
on('GET', '/api/states', async ({ env, user, url }) => {
  const since = sqlTime(url.searchParams.get('since'));
  const { results } = await env.DB.prepare(
    'SELECT * FROM states WHERE user = ? AND created_at >= ? ORDER BY created_at',
  ).bind(user, since).all();
  return json(results);
});

on('POST', '/api/states', async ({ req, env, user }) => {
  const b = await body<{ mood?: number; energy?: number; note?: string }>(req);
  const mood = b.mood && b.mood >= 1 && b.mood <= 5 ? b.mood : null;
  const energy = b.energy && b.energy >= 1 && b.energy <= 3 ? b.energy : null;
  if (!mood && !energy) return bad('humeur ou énergie requise');
  const rowId = id();
  await env.DB.prepare('INSERT INTO states (id, user, mood, energy, note) VALUES (?, ?, ?, ?, ?)')
    .bind(rowId, user, mood, energy, b.note?.slice(0, 300) ?? null).run();
  return json(await env.DB.prepare('SELECT * FROM states WHERE id = ?').bind(rowId).first(), 201);
});

// Export de toutes les données de l'utilisateur ---------------------------------
on('GET', '/api/export', async ({ env, user }) => {
  const all = async (t: string, col = 'user') => (await env.DB.prepare(`SELECT * FROM ${t} WHERE ${col} = ?`).bind(user).all()).results;
  return new Response(JSON.stringify({
    user: await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(user).first(),
    tasks: await all('tasks'), thoughts: await all('thoughts'), reminders: await all('reminders'),
    panier: await all('panier'), states: await all('states'), knots: await all('knots'),
  }, null, 2), { headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="pelote-export.json"' } });
});

/* --------------------------------------------------------------- entry -- */

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const user = await currentUser(request, env).catch(() => null);
  if (!user) return bad('non connecté', 401);
  const url = new URL(request.url);
  for (const [method, re, handler] of routes) {
    if (method !== request.method) continue;
    const m = url.pathname.match(re);
    if (m) {
      try {
        return await handler({ req: request, env, user, url, params: m.slice(1).map(decodeURIComponent) });
      } catch (err) {
        console.error(err);
        return bad('erreur serveur', 500);
      }
    }
  }
  return bad('route inconnue', 404);
};
