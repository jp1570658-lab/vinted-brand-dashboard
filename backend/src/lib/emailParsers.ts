import type { ParsedSale } from './saleMatcher';

/**
 * Pure parsers for the emails the Gmail sync understands (Dashboard Upgrade §1, §2):
 * Vinted / Depop / Vestiaire Collective sale notifications and Western Union
 * transfer receipts. No I/O here — DEMO feeds sample emails through the same code
 * LIVE uses, so the parsing is exercised either way.
 *
 * Email layouts change and differ per country, so every field is found by
 * label-proximity rather than fixed positions, and anything we can't read
 * confidently is skipped (and reported) instead of guessed.
 */

export interface RawEmail {
  id: string; // Gmail message id (stable → used for dedup when no better id)
  from: string;
  subject: string;
  body: string; // plain text (HTML stripped)
  date: Date;
}

/** A transfer receipt that becomes an expense row. */
export interface ParsedExpense {
  externalId: string; // e.g. WU-<MTCN>; dedup key stored as wiseId
  date: Date;
  description: string;
  amountEur: number;
  feeEur: number | null;
  receiver: string | null;
}

export type ParsedEmail =
  | { kind: 'sale'; sale: ParsedSale; note?: string }
  | { kind: 'expense'; expense: ParsedExpense }
  | { kind: 'skip'; reason: string };

/** "€ 1.234,56", "1 234,56 €", "EUR 450.00", "€450" → number (EUR only). */
export function parseEuro(text: string): number | null {
  const m =
    /(?:€|EUR)\s*(\d[\d.,\s]*\d|\d)/i.exec(text) ?? /(\d[\d.,\s]*\d|\d)\s*(?:€|EUR)/i.exec(text);
  if (!m) return null;
  let raw = m[1].replace(/\s/g, '');
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  if (lastComma > lastDot) {
    raw = raw.replace(/\./g, '').replace(',', '.'); // 1.234,56 → 1234.56
  } else if (lastDot > -1 && lastComma > -1) {
    raw = raw.replace(/,/g, ''); // 1,234.56 → 1234.56
  } else if (lastComma > -1 && raw.length - lastComma - 1 !== 2) {
    raw = raw.replace(/,/g, ''); // 1,234 → 1234
  } else {
    raw = raw.replace(',', '.');
  }
  const n = parseFloat(raw);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** First euro amount within a short window after any of the labels. */
export function amountAfter(text: string, labels: string[]): number | null {
  const lower = text.toLowerCase();
  for (const label of labels) {
    let at = lower.indexOf(label);
    while (at !== -1) {
      const n = parseEuro(text.slice(at + label.length, at + label.length + 60));
      if (n != null) return n;
      at = lower.indexOf(label, at + 1);
    }
  }
  return null;
}

/** Text after a label up to the end of its line. */
function lineAfter(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const m = new RegExp(`\\b${label}\\b\\s*:?\\s*([^\\n]+)`, 'i').exec(text);
    if (m && m[1].trim()) return m[1].trim().slice(0, 120);
  }
  return null;
}

const has = (s: string, words: string[]) => words.some((w) => s.toLowerCase().includes(w));

function parseVinted(e: RawEmail): ParsedEmail {
  if (!has(e.subject, ['vous avez vendu', "you've sold", 'you have sold'])) {
    return { kind: 'skip', reason: 'Vinted email that is not a sale' };
  }
  const price = parseEuro(e.body) ?? parseEuro(e.subject);
  if (price == null) return { kind: 'skip', reason: 'Vinted sale without a readable price' };
  const title =
    lineAfter(e.subject, ['vous avez vendu', "you've sold", 'you have sold']) ??
    e.body.split('\n').find((l) => l.trim())?.trim().slice(0, 120) ??
    e.subject;
  return { kind: 'sale', sale: { title, price, orderId: e.id, channel: 'Vinted', raw: e.subject } };
}

function parseDepop(e: RawEmail): ParsedEmail {
  if (!has(e.subject, ['you made a sale', 'you sold', 'item sold'])) {
    return { kind: 'skip', reason: 'Depop email that is not a sale' };
  }
  const price = amountAfter(e.body, ['item price', 'sale price', 'sold for', 'price', 'total']);
  if (price == null) return { kind: 'skip', reason: 'Depop sale without a readable price' };
  const depopFee = amountAfter(e.body, ['depop fee', 'selling fee']) ?? 0;
  const paymentFee = amountAfter(e.body, ['payment processing fee', 'processing fee', 'payment fee']) ?? 0;
  const buyerShipping = amountAfter(e.body, ['buyer shipping', 'shipping', 'postage']);
  const title = lineAfter(e.body, ['you sold', 'item name', 'item title']) ?? e.subject;
  return {
    kind: 'sale',
    sale: {
      title,
      price,
      orderId: e.id,
      channel: 'Depop',
      platformFee: depopFee + paymentFee > 0 ? Math.round((depopFee + paymentFee) * 100) / 100 : undefined,
      raw: e.subject,
    },
    note: buyerShipping != null ? `buyer paid €${buyerShipping} shipping` : undefined,
  };
}

function parseVestiaire(e: RawEmail): ParsedEmail {
  const subj =
    /your item (.+?) has (?:been )?sold/i.exec(e.subject) ?? /votre article (.+?) a été vendu/i.exec(e.subject);
  if (!subj && !has(e.subject, ['has sold', 'a été vendu', 'item sold'])) {
    return { kind: 'skip', reason: 'Vestiaire email that is not a sale' };
  }
  const price =
    amountAfter(e.body, ['selling price', 'sale price', 'prix de vente', 'price', 'prix']) ?? parseEuro(e.body);
  if (price == null) return { kind: 'skip', reason: 'Vestiaire sale without a readable price' };
  const fee = amountAfter(e.body, ['commission', 'fees', 'frais']);
  const title = subj?.[1] ?? lineAfter(e.body, ['item name', 'article']) ?? e.subject;
  return {
    kind: 'sale',
    sale: {
      title,
      price,
      orderId: e.id,
      channel: 'Vestiaire Collective',
      platformFee: fee ?? undefined,
      raw: e.subject,
    },
  };
}

function parseWesternUnion(e: RawEmail): ParsedEmail {
  const text = `${e.subject}\n${e.body}`;
  if (!has(text, ['mtcn', 'tracking number', 'transfer', 'receipt', 'money sent', 'sent money'])) {
    return { kind: 'skip', reason: 'Western Union email that is not a transfer receipt' };
  }
  const amount = amountAfter(e.body, ['transfer amount', 'amount sent', 'you sent', 'send amount', 'amount']);
  if (amount == null) return { kind: 'skip', reason: 'Western Union receipt without a readable EUR amount' };
  const fee = amountAfter(e.body, ['transfer fee', 'transfer fees', 'fee']);
  const mtcn = /(?:mtcn|tracking number)\D{0,20}(\d[\d\s-]{8,14}\d)/i.exec(text)?.[1].replace(/\D/g, '');
  const receiver = lineAfter(e.body, ['receiver name', 'receiver', 'recipient', 'sent to']);
  return {
    kind: 'expense',
    expense: {
      externalId: `WU-${mtcn ?? e.id}`,
      date: e.date,
      description: `Western Union${receiver ? ` to ${receiver}` : ''}${mtcn ? ` · MTCN ${mtcn}` : ''}`,
      amountEur: amount,
      feeEur: fee,
      receiver,
    },
  };
}

/** Route an email to its parser by sender domain. */
export function parseEmail(e: RawEmail): ParsedEmail {
  const from = e.from.toLowerCase();
  if (from.includes('vinted.')) return parseVinted(e);
  if (from.includes('depop.com')) return parseDepop(e);
  if (from.includes('vestiairecollective.com')) return parseVestiaire(e);
  if (from.includes('westernunion.')) return parseWesternUnion(e);
  return { kind: 'skip', reason: `unrecognised sender ${e.from}` };
}

/** Gmail search covering every sender parseEmail understands. */
export const GMAIL_QUERY =
  'from:(vinted.fr OR vinted.com OR vinted.be OR depop.com OR vestiairecollective.com OR westernunion.com OR westernunion.be) newer_than:7d';
