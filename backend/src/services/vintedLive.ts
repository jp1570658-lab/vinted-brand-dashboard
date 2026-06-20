import axios from 'axios';

/**
 * LIVE Vinted scraper.
 *
 * Vinted has no public API. This reads your OWN wardrobe via the site's internal
 * JSON endpoint, authenticated with the session cookie copied from your logged-in
 * browser. It is read-only and only touches your own account.
 *
 * Required env (see .env.example):
 *   VINTED_DOMAIN   e.g. "www.vinted.co.uk" (use the TLD you log in on)
 *   VINTED_USER_ID  your numeric Vinted user id (from your profile URL)
 *   VINTED_COOKIE   the full Cookie header from a logged-in request (must include access_token_web)
 *
 * NOTE: scraping is against Vinted's ToS and the endpoint shape can change without
 * notice. Failures are surfaced as thrown errors so the diff in vinted.ts can abort
 * safely (a failed fetch must never look like "everything sold").
 */

export interface VintedListing {
  vintedItemId: string;
  title: string;
  price: number | null; // EUR (or listing currency — used only as the sale price hint)
  isClosed: boolean; // true once the listing is sold/delisted; it stays in the wardrobe
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function config() {
  const domain = process.env.VINTED_DOMAIN;
  const userId = process.env.VINTED_USER_ID;
  const cookie = process.env.VINTED_COOKIE;
  if (!domain || !userId || !cookie) {
    throw new Error(
      'Vinted scraper not configured. Set VINTED_DOMAIN, VINTED_USER_ID and VINTED_COOKIE in .env.',
    );
  }
  return { domain, userId, cookie };
}

/** Normalize Vinted's varied price shapes ("12.0" | {amount}) to a number. */
function parsePrice(raw: any): number | null {
  const v =
    raw && typeof raw === 'object' ? (raw.amount ?? raw.value ?? null) : raw;
  if (v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Fetch every listing in your wardrobe (active AND closed/sold). Vinted keeps sold
 * listings in the wardrobe with `is_closed: true` rather than removing them, so the
 * caller distinguishes "still for sale" from "sold" via the isClosed flag — a sale
 * is a listing that was active on a previous run and is now closed (or gone).
 *
 * Paginates by the server-reported total_pages (Vinted often returns fewer items
 * than per_page, so a "short page" does NOT mean the last page). Throws on
 * auth/network failure so the caller can abort safely.
 */
export async function fetchWardrobe(): Promise<VintedListing[]> {
  const { domain, userId, cookie } = config();
  const perPage = 100;
  const listings: VintedListing[] = [];

  let totalPages = 1;
  for (let page = 1; page <= totalPages && page <= 100; page++) {
    const url = `https://${domain}/api/v2/wardrobe/${userId}/items`;
    const { data } = await axios.get(url, {
      params: { page, per_page: perPage },
      headers: {
        Cookie: cookie,
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en',
        Referer: `https://${domain}/member/${userId}`,
      },
      timeout: 20000,
    });

    // A valid wardrobe response always carries an `items` array and a pagination
    // block. Its absence means we were blocked/redirected (soft failure) — throw.
    if (!Array.isArray(data?.items) || !data?.pagination) {
      throw new Error('Unexpected Vinted wardrobe response shape (blocked or expired cookie?).');
    }
    totalPages = Number(data.pagination.total_pages) || 1;

    for (const it of data.items as any[]) {
      if (it?.id == null) continue;
      listings.push({
        vintedItemId: String(it.id),
        title: String(it.title ?? `${it.brand_title ?? ''} ${it.name ?? ''}`).trim() || `item ${it.id}`,
        price: parsePrice(it.price) ?? parsePrice(it.total_item_price),
        isClosed: Boolean(it.is_closed),
      });
    }
  }

  return listings;
}
