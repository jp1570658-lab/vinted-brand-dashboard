import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';
import { GMAIL_QUERY, type RawEmail } from '../lib/emailParsers';

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

/** Base64url-decode every text part; HTML is flattened to text so label parsing works. */
function decodeBody(payload: any): string {
  const parts: string[] = [];
  const walk = (p: any) => {
    if (!p) return;
    if (p.body?.data && /^text\//.test(p.mimeType ?? 'text/plain')) {
      const raw = Buffer.from(p.body.data, 'base64').toString('utf8');
      parts.push(
        p.mimeType === 'text/html'
          ? raw
              .replace(/<(br|\/p|\/div|\/tr|\/li|\/h\d)[^>]*>/gi, '\n')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/&euro;/g, '€')
              .replace(/&amp;/g, '&')
              .replace(/[ \t]+/g, ' ')
          : raw,
      );
    }
    if (p.parts) p.parts.forEach(walk);
  };
  walk(payload);
  return parts.join('\n');
}

/**
 * Fetch the last 7 days of emails from every sender the parsers understand
 * (Vinted, Depop, Vestiaire Collective, Western Union). Parsing happens in
 * lib/emailParsers.ts so DEMO and LIVE share it.
 */
export async function fetchLiveEmails(): Promise<RawEmail[]> {
  const auth = await authorizedClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const list = await gmail.users.messages.list({ userId: 'me', q: GMAIL_QUERY, maxResults: 50 });
  const emails: RawEmail[] = [];
  for (const msg of list.data.messages ?? []) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id!, format: 'full' });
    const headers = full.data.payload?.headers ?? [];
    const header = (name: string) => headers.find((h) => h.name?.toLowerCase() === name)?.value ?? '';
    emails.push({
      id: msg.id!,
      from: header('from'),
      subject: header('subject'),
      body: decodeBody(full.data.payload) || (full.data.snippet ?? ''),
      date: full.data.internalDate ? new Date(Number(full.data.internalDate)) : new Date(),
    });
  }
  return emails;
}

/** True once the operator has completed the Google OAuth flow. */
export async function isGmailConnected(): Promise<boolean> {
  return (await prisma.googleToken.count()) > 0;
}
