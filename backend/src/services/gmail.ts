import { prisma } from '../lib/prisma';
import { isDemo } from './mode';
import { matchAndSell } from '../lib/saleMatcher';
import { parseEmail, type ParsedExpense, type RawEmail } from '../lib/emailParsers';
import { matchRunnerId } from '../lib/runnerLedger';

export type { ParsedSale } from '../lib/saleMatcher';

export interface GmailSyncResult {
  emailCount: number;
  salesFound: number;
  matched: number;
  unmatched: number;
  expensesCreated: number;
  soldItemIds: string[];
  details: string[];
}

/**
 * DEMO: realistic sample emails (no network) run through the same parsers LIVE
 * uses — a Vinted sale for the oldest in-stock bag, a Depop sale for the next one
 * and a Western Union receipt (fixed MTCN, so it's only imported once).
 */
async function demoEmails(): Promise<RawEmail[]> {
  const inStock = await prisma.item.findMany({
    where: { status: 'IN_STOCK', deletedAt: null },
    orderBy: { stockAt: 'asc' },
    take: 2,
  });
  const price = (i: (typeof inStock)[number]) =>
    i.listedPrice ?? Math.round((i.purchasePriceEur ?? 100) * 1.8);
  const now = new Date();
  const emails: RawEmail[] = [];
  if (inStock[0]) {
    const i = inStock[0];
    emails.push({
      id: `DEMO-VINTED-${now.getTime()}`,
      from: 'Vinted <noreply@vinted.fr>',
      subject: `Vous avez vendu ${i.brand} ${i.model}`,
      body: `Bonne nouvelle !\n${i.brand} ${i.model}\nPrix : ${price(i).toFixed(2).replace('.', ',')} €`,
      date: now,
    });
  }
  if (inStock[1]) {
    const i = inStock[1];
    const p = price(i);
    emails.push({
      id: `DEMO-DEPOP-${now.getTime()}`,
      from: 'Depop <noreply@depop.com>',
      subject: 'You made a sale!',
      body: [
        `You sold ${i.brand} ${i.model}`,
        `Item price: €${p.toFixed(2)}`,
        `Depop fee: €${(p * 0.1).toFixed(2)}`,
        `Payment processing fee: €${(p * 0.033 + 0.45).toFixed(2)}`,
        'Buyer shipping: €6.50',
      ].join('\n'),
      date: now,
    });
  }
  const ada = await prisma.runner.findFirst({ orderBy: { createdAt: 'asc' } });
  emails.push({
    id: 'DEMO-WU-1',
    from: 'Western Union <noreply@westernunion.com>',
    subject: 'Your money transfer receipt',
    body: [
      'Thank you for sending money with Western Union.',
      `Receiver: ${ada?.name ?? 'Ada'}`,
      'Transfer amount: €300.00',
      'Transfer fee: €3.90',
      'Total: €303.90',
      'MTCN: 123-456-7890',
    ].join('\n'),
    date: now,
  });
  return emails;
}

/** Import a Western Union receipt as an unlinked expense; dedup by its external id. */
async function importExpense(e: ParsedExpense): Promise<boolean> {
  const exists = await prisma.wiseTransaction.findUnique({ where: { wiseId: e.externalId } });
  if (exists) return false;
  await prisma.wiseTransaction.create({
    data: {
      wiseId: e.externalId,
      date: e.date,
      amount: e.amountEur,
      currency: 'EUR',
      amountEur: e.amountEur,
      fee: e.feeEur,
      description: e.description,
      category: 'STOCK_PURCHASE',
      source: 'WESTERN_UNION',
      runnerId: e.receiver ? await matchRunnerId(e.receiver) : null,
    },
  });
  return true;
}

/**
 * Run a Gmail sync: sale emails (Vinted, Depop, Vestiaire) are matched to in-stock
 * bags and marked SOLD with their channel and fees; Western Union receipts become
 * unlinked expenses. DEMO uses sample emails; LIVE reads Gmail (gmailLive.ts).
 */
export async function runGmailSync(): Promise<GmailSyncResult> {
  let emails: RawEmail[];
  if (isDemo()) {
    emails = await demoEmails();
  } else {
    const live = await import('./gmailLive');
    emails = await live.fetchLiveEmails();
  }

  const soldItemIds: string[] = [];
  const details: string[] = [];
  let salesFound = 0;
  let matched = 0;
  let unmatched = 0;
  let expensesCreated = 0;

  for (const email of emails) {
    const parsed = parseEmail(email);
    if (parsed.kind === 'skip') continue;

    if (parsed.kind === 'expense') {
      const created = await importExpense(parsed.expense);
      if (created) {
        expensesCreated++;
        details.push(`Expense: ${parsed.expense.description} (€${parsed.expense.amountEur} + €${parsed.expense.feeEur ?? 0} fee)`);
      }
      continue;
    }

    salesFound++;
    const sale = parsed.sale;
    const id = await matchAndSell(sale, 'AUTO_GMAIL');
    const extra = parsed.note ? ` — ${parsed.note}` : '';
    if (id) {
      matched++;
      soldItemIds.push(id);
      details.push(`${sale.channel}: "${sale.title}" → item ${id} (€${sale.price})${extra}`);
    } else {
      unmatched++;
      details.push(`${sale.channel}: "${sale.title}" unmatched — logged for manual review${extra}`);
    }
  }

  await prisma.gmailSync.create({
    data: { lastSyncAt: new Date(), emailCount: emails.length, salesFound },
  });

  return { emailCount: emails.length, salesFound, matched, unmatched, expensesCreated, soldItemIds, details };
}

export async function lastGmailSync() {
  return prisma.gmailSync.findFirst({ orderBy: { lastSyncAt: 'desc' } });
}
