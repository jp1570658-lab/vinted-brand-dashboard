import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';
import type { ParsedSale } from './gmail';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

export function createOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getAuthUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

/** Exchange the OAuth code for tokens and persist the refresh token. */
export async function handleOAuthCallback(code: string): Promise<void> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned — revoke app access and retry with prompt=consent');
  }
  await prisma.googleToken.deleteMany();
  await prisma.googleToken.create({
    data: {
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? null,
      expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });
}

async function authorizedClient(): Promise<OAuth2Client> {
  const token = await prisma.googleToken.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!token) throw new Error('Gmail is not connected. Authorize via /api/auth/google first.');
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: token.refreshToken });
  return client;
}

// Price regex: matches "€ 1.234,56" / "€1234.56" etc. Returns a normalized number.
const PRICE_RE = /€\s*([\d.,]+)/;
function parsePrice(text: string): number | null {
  const m = text.match(PRICE_RE);
  if (!m) return null;
  // Normalize European formatting: strip thousands sep, use dot as decimal.
  let raw = m[1];
  if (raw.includes(',') && raw.includes('.')) raw = raw.replace(/\./g, '').replace(',', '.');
  else if (raw.includes(',')) raw = raw.replace(',', '.');
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

const SALE_SUBJECTS = ['vous avez vendu', "you've sold", 'you have sold'];

function decodeBody(payload: any): string {
  const parts: string[] = [];
  const walk = (p: any) => {
    if (!p) return;
    if (p.body?.data) parts.push(Buffer.from(p.body.data, 'base64').toString('utf8'));
    if (p.parts) p.parts.forEach(walk);
  };
  walk(payload);
  return parts.join('\n');
}

/** Poll Gmail for Vinted sale emails and parse them. */
export async function fetchLiveSales(): Promise<{ emailCount: number; sales: ParsedSale[] }> {
  const auth = await authorizedClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const list = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:(noreply@vinted.fr OR noreply@vinted.com) newer_than:7d',
    maxResults: 25,
  });
  const messages = list.data.messages ?? [];
  const sales: ParsedSale[] = [];

  for (const msg of messages) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id!, format: 'full' });
    const headers = full.data.payload?.headers ?? [];
    const subject = (headers.find((h) => h.name === 'Subject')?.value ?? '').toLowerCase();
    if (!SALE_SUBJECTS.some((s) => subject.includes(s))) continue;

    const body = decodeBody(full.data.payload);
    const price = parsePrice(body) ?? parsePrice(subject);
    if (price == null) continue;

    // Title: best-effort extract from subject after the sale phrase, else snippet.
    const title = (full.data.snippet ?? subject).slice(0, 120);
    sales.push({ title, price, orderId: msg.threadId ?? undefined, raw: subject });
  }

  return { emailCount: messages.length, sales };
}
