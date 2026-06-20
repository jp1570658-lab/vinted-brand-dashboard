import axios from 'axios';
import { prisma } from '../lib/prisma';

/**
 * LIVE Vinted scraper.
 *
 * Vinted has no public API. This reads your OWN wardrobe via the site's internal
 * JSON endpoint, authenticated with the session copied from your logged-in browser.
 * It is read-only and only touches your own account.
 *
 * Auth model (discovered empirically):
 *   - `access_token_web` is a JWT that expires after ~2 hours, so it cannot be used
 *     directly by a once-a-day cron — it is always stale by the time the job fires.
 *   - `refresh_token_web` lives ~7 days. POST /web/api/auth/refresh exchanges it for
 *     a fresh access token. BUT refresh tokens are SINGLE-USE and ROTATE: each call
 *     issues a new refresh token and immediately invalidates the old one.
 *
 * Therefore the live cookie jar (rotating refresh_token_web + _vinted_fr_session +
 * datadome) is persisted in the VintedAuth table and rewritten after every refresh.
 * A static env cookie would work exactly once and then 401 forever.
 *
 * Required env (see .env.example):
 *   VINTED_DOMAIN   e.g. "www.vinted.com" (the TLD you log in on)
 *   VINTED_USER_ID  your numeric Vinted user id (from your profile URL)
 *   VINTED_COOKIE   a full Cookie header from a logged-in request — used only to
 *                   SEED the jar. It must include refresh_token_web. Update this env
 *                   after a fresh login to re-seed (the jar auto-detects the change).
 *
 * NOTE: scraping is against Vinted's ToS and the endpoint shape can change without
 * notice. Failures are thrown so the diff in vinted.ts aborts safely (a failed fetch
 * must never look like "everything sold").
 */

export interface VintedListing {
  vintedItemId: string;
  title: string;
  price: number | null; // EUR (or listing currency — used only as the sale price hint)
  isClosed: boolean; // true once the listing is sold/delisted; it stays in the wardrobe
  favouriteCount: number | null; // ❤ likes — demand signal, tracked over time for the AI
  // Extra metadata, used by the wardrobe → dashboard importer (not by sale detection):
  brand: string | null;
  photoUrl: string | null;
  condition: string | null; // Vinted item condition, e.g. "Very good"
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const AUTH_ROW_ID = 'singleton';

function baseConfig() {
  const domain = process.env.VINTED_DOMAIN;
  const userId = process.env.VINTED_USER_ID;
  const seed = process.env.VINTED_COOKIE;
  if (!domain || !userId || !seed) {
    throw new Error(
      'Vinted scraper not configured. Set VINTED_DOMAIN, VINTED_USER_ID and VINTED_COOKIE in .env.',
    );
  }
  return { domain, userId, seed };
}

// ---- cookie jar helpers ---------------------------------------------------

type Jar = Record<string, string>;

function parseJar(cookieHeader: string): Jar {
  const jar: Jar = {};
  for (const part of cookieHeader.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) jar[k] = v;
  }
  return jar;
}

function serializeJar(jar: Jar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/** Merge a response's Set-Cookie array into the jar (token rotation, datadome, etc.). */
function mergeSetCookie(jar: Jar, setCookie: string[] | undefined): void {
  for (const sc of setCookie ?? []) {
    const kv = sc.split(';')[0];
    const i = kv.indexOf('=');
    if (i < 0) continue;
    const k = kv.slice(0, i).trim();
    const v = kv.slice(i + 1).trim();
    if (k) jar[k] = v;
  }
}

/**
 * Load the live jar. Seeds from VINTED_COOKIE on first use, and RE-seeds whenever the
 * env seed changes (i.e. you pasted a fresh cookie after a re-login).
 */
async function loadJar(seed: string): Promise<Jar> {
  const row = await prisma.vintedAuth.findUnique({ where: { id: AUTH_ROW_ID } });
  if (!row || row.seed !== seed) {
    // First run, or the operator supplied a new seed cookie — (re)initialize.
    await prisma.vintedAuth.upsert({
      where: { id: AUTH_ROW_ID },
      create: { id: AUTH_ROW_ID, cookie: seed, seed },
      update: { cookie: seed, seed },
    });
    return parseJar(seed);
  }
  return parseJar(row.cookie);
}

async function saveJar(jar: Jar, seed: string): Promise<void> {
  const cookie = serializeJar(jar);
  await prisma.vintedAuth.upsert({
    where: { id: AUTH_ROW_ID },
    create: { id: AUTH_ROW_ID, cookie, seed },
    update: { cookie },
  });
}

/** Normalize Vinted's varied price shapes ("12.0" | {amount}) to a number. */
function parsePrice(raw: any): number | null {
  const v = raw && typeof raw === 'object' ? (raw.amount ?? raw.value ?? null) : raw;
  if (v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function headers(jar: Jar, domain: string, accept = 'application/json, text/plain, */*') {
  return {
    Cookie: serializeJar(jar),
    'User-Agent': USER_AGENT,
    Accept: accept,
    'Accept-Language': 'en',
    Referer: `https://${domain}/`,
  };
}

/**
 * Exchange the (rotating, single-use) refresh token for a fresh access token, then
 * PERSIST the rotated jar immediately so the new refresh token is never lost. Throws
 * a clear, actionable error if the session has expired and needs a fresh cookie.
 */
async function refreshSession(jar: Jar, domain: string, seed: string): Promise<void> {
  const url = `https://${domain}/web/api/auth/refresh`;
  const res = await axios.post(url, '{}', {
    headers: { ...headers(jar, domain), 'Content-Type': 'application/json' },
    timeout: 20000,
    validateStatus: () => true, // inspect status ourselves
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Vinted session expired (refresh returned ${res.status}). Re-grab a fresh cookie from your browser ` +
        '(it must include refresh_token_web) and update the VINTED_COOKIE env var. No items were marked sold.',
    );
  }
  if (res.status !== 200) {
    throw new Error(`Vinted token refresh failed (HTTP ${res.status}). No items were marked sold.`);
  }

  mergeSetCookie(jar, res.headers['set-cookie'] as string[] | undefined);

  // Sanity: the refresh must have set a NEW access token, or auth silently failed.
  if (!jar.access_token_web) {
    throw new Error('Vinted token refresh returned no access_token_web. No items were marked sold.');
  }

  // Persist the rotated refresh_token_web (+ datadome) RIGHT NOW. If anything after
  // this throws, the next run still has a usable, un-consumed refresh token.
  await saveJar(jar, seed);
}

/**
 * Fetch every listing in your wardrobe (active AND closed/sold). Vinted keeps sold
 * listings in the wardrobe with `is_closed: true` rather than removing them, so the
 * caller distinguishes "still for sale" from "sold" via the isClosed flag.
 *
 * Refreshes the access token first (see auth model above), then paginates by the
 * server-reported total_pages (Vinted often returns fewer items than per_page, so a
 * "short page" does NOT mean the last page). Throws on auth/network failure.
 */
export async function fetchWardrobe(): Promise<VintedListing[]> {
  const { domain, userId, seed } = baseConfig();
  const jar = await loadJar(seed);
  await refreshSession(jar, domain, seed);

  const perPage = 100;
  const listings: VintedListing[] = [];

  let totalPages = 1;
  for (let page = 1; page <= totalPages && page <= 100; page++) {
    const url = `https://${domain}/api/v2/wardrobe/${userId}/items`;
    const { data, headers: respHeaders } = await axios.get(url, {
      params: { page, per_page: perPage },
      headers: { ...headers(jar, domain), Referer: `https://${domain}/member/${userId}` },
      timeout: 20000,
    });

    // Keep any rotated cookies (e.g. datadome) fresh across the paginated calls.
    mergeSetCookie(jar, (respHeaders as any)?.['set-cookie']);

    // A valid wardrobe response always carries an `items` array and a pagination
    // block. Its absence means we were blocked/redirected (soft failure) — throw.
    if (!Array.isArray(data?.items) || !data?.pagination) {
      throw new Error('Unexpected Vinted wardrobe response shape (blocked or expired session?).');
    }
    totalPages = Number(data.pagination.total_pages) || 1;

    for (const it of data.items as any[]) {
      if (it?.id == null) continue;
      // Vinted's shapes vary: brand may be a string or {title}; photos[] entries
      // expose `url` (and sometimes `full_size_url`); `status` holds the condition.
      const brand =
        it.brand_title ?? (typeof it.brand === 'string' ? it.brand : (it.brand?.title ?? null));
      const photo = Array.isArray(it.photos) && it.photos[0] ? it.photos[0] : null;
      // Vinted exposes the like count as favourite_count (sometimes favourite_count is
      // nested under a stats-style block); fall back gracefully to null.
      const likes = it.favourite_count ?? it.favourites_count ?? it.favourited_count ?? null;
      listings.push({
        vintedItemId: String(it.id),
        title:
          String(it.title ?? `${it.brand_title ?? ''} ${it.name ?? ''}`).trim() || `item ${it.id}`,
        price: parsePrice(it.price) ?? parsePrice(it.total_item_price),
        isClosed: Boolean(it.is_closed),
        favouriteCount: likes == null ? null : Number(likes),
        brand: brand ? String(brand) : null,
        photoUrl: photo ? (photo.url ?? photo.full_size_url ?? null) : null,
        condition: typeof it.status === 'string' ? it.status : null,
      });
    }
  }

  // Persist any cookies rotated during pagination.
  await saveJar(jar, seed);

  return listings;
}
