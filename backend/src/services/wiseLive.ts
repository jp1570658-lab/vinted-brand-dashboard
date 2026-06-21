import axios from 'axios';
import type { RawTransfer } from './wise';

const WISE_BASE = 'https://api.transferwise.com';

function authHeaders() {
  const key = process.env.WISE_API_KEY;
  if (!key) throw new Error('WISE_API_KEY is not configured');
  return { Authorization: `Bearer ${key}` };
}

/** Resolve the profile id (cached via env once discovered). */
async function getProfileId(): Promise<string> {
  if (process.env.WISE_PROFILE_ID) return process.env.WISE_PROFILE_ID;
  const { data } = await axios.get(`${WISE_BASE}/v1/profiles`, { headers: authHeaders() });
  const profile = Array.isArray(data) ? data[0] : null;
  if (!profile?.id) throw new Error('No Wise profile found');
  return String(profile.id);
}

/** Poll Wise for sent outgoing payments and normalize them. */
export async function fetchLiveTransfers(): Promise<RawTransfer[]> {
  const profileId = await getProfileId();
  // Wise's v1 transfer list: filter by profile + status. (The v3 path is for
  // creating transfers, not listing them, and 404s on a list request.)
  const { data } = await axios.get(`${WISE_BASE}/v1/transfers`, {
    headers: authHeaders(),
    params: { profile: profileId, status: 'outgoing_payment_sent', limit: 100 },
  });

  const transfers = Array.isArray(data?.transfers) ? data.transfers : Array.isArray(data) ? data : [];
  return transfers.map((t: any): RawTransfer => {
    const sourceCcy = String(t.sourceCurrency ?? 'EUR');
    const targetCcy = String(t.targetCurrency ?? sourceCcy);
    const reference = (t.details?.reference || t.reference || '').toString().trim();
    return {
      wiseId: String(t.id),
      date: new Date(t.created ?? t.date ?? Date.now()),
      amount: Number(t.sourceValue ?? t.targetValue ?? 0),
      currency: sourceCcy,
      // Wise references are often blank; fall back to a readable summary so the
      // transaction list isn't full of bare account numbers.
      description: reference || `Transfer ${sourceCcy}→${targetCcy}`,
    };
  });
}
