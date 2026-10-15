import { prisma } from '../lib/prisma';
import { isDemo } from './mode';

const AGING_DAYS = 14;

export interface FlaggedItem {
  id: string;
  name: string;
  runner: string;
  location: string;
  daysStuck: number;
  valueEur: number;
}

const daysSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));

/** SOURCED items older than the aging threshold. */
export async function getFlaggedItems(): Promise<FlaggedItem[]> {
  const cutoff = new Date(Date.now() - AGING_DAYS * 24 * 60 * 60 * 1000);
  const items = await prisma.item.findMany({
    where: { status: 'SOURCED', deletedAt: null, sourcedAt: { lt: cutoff } },
    include: { runner: true },
    orderBy: { sourcedAt: 'asc' },
  });
  return items.map((i) => ({
    id: i.id,
    name: `${i.brand} ${i.model}`,
    runner: i.runner?.name ?? '—',
    location: i.runner?.location ?? '—',
    daysStuck: daysSince(i.sourcedAt),
    valueEur: i.purchasePriceEur ?? 0,
  }));
}

function buildEmail(flagged: FlaggedItem[]) {
  const plural = flagged.length > 1;
  const subject = `🔴 Vinted Dashboard Alert — ${flagged.length} bag${plural ? 's' : ''} need${plural ? '' : 's'} attention`;
  const rows = flagged
    .map(
      (f) =>
        `<tr><td>${f.name}</td><td>${f.runner}</td><td>${f.daysStuck} days</td><td>€${f.valueEur.toFixed(2)}</td></tr>`,
    )
    .join('');
  const html = `
    <h2>Bags stuck abroad over ${AGING_DAYS} days</h2>
    <table border="1" cellpadding="6" cellspacing="0">
      <tr><th>Item</th><th>Runner</th><th>Days stuck</th><th>Value at risk</th></tr>
      ${rows}
    </table>`;
  return { subject, html };
}

export interface AlertResult {
  sent: boolean;
  count: number;
  subject?: string;
  /** Why nothing was sent, when count > 0 but sent is false. */
  skipped?: 'not-configured' | 'delivery-failed';
  error?: string;
}

/**
 * Send (or in DEMO, log) the daily aging alert. Returns what was sent so the
 * manual-trigger endpoint can report it. No flagged items → nothing sent.
 *
 * Email delivery is best-effort: a missing or broken SMTP setup must never
 * mask the flagged-item count, which is the part the dashboard banner uses.
 */
export async function sendAgingAlert(): Promise<AlertResult> {
  const flagged = await getFlaggedItems();
  if (flagged.length === 0) return { sent: false, count: 0 };

  const { subject, html } = buildEmail(flagged);

  if (isDemo()) {
    console.log(`[alerts] DEMO — would email: ${subject}`);
    for (const f of flagged) console.log(`  • ${f.name} — ${f.runner} — ${f.daysStuck}d — €${f.valueEur}`);
    return { sent: true, count: flagged.length, subject };
  }

  const user = process.env.ALERT_EMAIL_USER;
  const pass = process.env.ALERT_EMAIL_PASS;
  if (!user || !pass) {
    console.warn(
      `[alerts] ${flagged.length} item(s) flagged but no email sent: ALERT_EMAIL_USER/ALERT_EMAIL_PASS are not set.`,
    );
    return { sent: false, count: flagged.length, subject, skipped: 'not-configured' };
  }

  // LIVE: send via Nodemailer using Gmail (app password or OAuth-configured transport).
  // Explicit timeouts — without them a blocked SMTP port hangs the job until the
  // socket dies, which is what produced the old bare "Connection timeout".
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  try {
    await transport.sendMail({
      from: user,
      to: process.env.ALERT_EMAIL_TO || user,
      subject,
      html,
    });
    return { sent: true, count: flagged.length, subject };
  } catch (e) {
    const error = (e as Error).message;
    console.error(`[alerts] ${flagged.length} item(s) flagged but delivery failed: ${error}`);
    return { sent: false, count: flagged.length, subject, skipped: 'delivery-failed', error };
  } finally {
    transport.close();
  }
}
