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
 * Fetch the current active listings in your wardrobe. Paginates until exhausted.
 * Throws on auth/network failure (never returns a partial/empty list silently).
 */
export async function fetchWardrobe(): Promise<VintedListing[]> {
  const { domain, userId, cookie } = config();
  const perPage = 100;
  const listings: VintedListing[] = [];

  for (let page = 1; page <= 50; page++) {
    const url = `https://${domain}/api/v2/users/${userId}/items`;
    const { data } = await axios.get(url, {
      params: { page, per_page: perPage, order: 'newest_first' },
      headers: {
        Cookie: cookie,
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en',
        Referer: `https://${domain}/member/${userId}`,
      },
      timeout: 20000,
    });

    const items: any[] = Array.isArray(data?.items) ? data.items : [];
    for (const it of items) {
      if (it?.id == null) continue;
      listings.push({
        vintedItemId: String(it.id),
        title: String(it.title ?? `${it.brand_title ?? ''} ${it.name ?? ''}`).trim() || `item ${it.id}`,
        price: parsePrice(it.price) ?? parsePrice(it.total_item_price),
      });
    }

    if (items.length < perPage) break; // last page reached
  }

  // An authenticated wardrobe fetch that yields zero items is treated as a failure
  // by the caller's guard, so don't special-case it here.
  return listings;
}
