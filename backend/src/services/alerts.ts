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

/**
 * Send (or in DEMO, log) the daily aging alert. Returns what was sent so the
 * manual-trigger endpoint can report it. No flagged items → nothing sent.
 */
export async function sendAgingAlert(): Promise<{ sent: boolean; count: number; subject?: string }> {
  const flagged = await getFlaggedItems();
  if (flagged.length === 0) return { sent: false, count: 0 };

  const { subject, html } = buildEmail(flagged);

  if (isDemo()) {
    console.log(`[alerts] DEMO — would email: ${subject}`);
    for (const f of flagged) console.log(`  • ${f.name} — ${f.runner} — ${f.daysStuck}d — €${f.valueEur}`);
    return { sent: true, count: flagged.length, subject };
  }

  // LIVE: send via Nodemailer using Gmail (app password or OAuth-configured transport).
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.ALERT_EMAIL_USER, pass: process.env.ALERT_EMAIL_PASS },
  });
  await transport.sendMail({
    from: process.env.ALERT_EMAIL_USER,
    to: process.env.ALERT_EMAIL_TO || process.env.ALERT_EMAIL_USER,
    subject,
    html,
  });
  return { sent: true, count: flagged.length, subject };
}
