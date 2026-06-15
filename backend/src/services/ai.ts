import { prisma } from '../lib/prisma';
import { isDemo } from './mode';
import { calcMarginPct } from '../lib/profit';

const MIN_SOLD_FOR_AI = 5;
const EMPTY = {
  message: 'Not enough data yet. Add at least 5 sold items to unlock AI insights.',
};

// ---- data gathering ------------------------------------------------------

async function soldItems() {
  return prisma.item.findMany({
    where: { status: 'SOLD', deletedAt: null, soldAt: { not: null } },
    include: { runner: true },
    orderBy: { soldAt: 'desc' },
  });
}

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)));
}

// ---- DEMO hardcoded responses --------------------------------------------

const DEMO_PRICING = {
  daysToSell: 12,
  recommendedPrice: 1450,
  confidence: 'high' as const,
  reasoning:
    'Comparable luxury flap bags in grade A have sold within 10–14 days at €1,400–1,500 over the last 90 days. Pricing at €1,450 balances speed and margin.',
};

const DEMO_FORECAST = {
  forecastRevenue: 8200,
  forecastProfit: 3100,
  confidence: 'medium' as const,
  risks: [
    'Two items have been stuck abroad for over 14 days, tying up capital.',
    'Sales concentrated in a single brand — diversify sourcing.',
  ],
  narrative:
    'Based on the last three months of weekly sales and current inventory, expect roughly €8,200 in revenue next month at ~38% net margin. Clearing aged stock would lift profit further.',
};

const DEMO_SOURCING = {
  priorityThisWeek: 'Sam',
  runners: [
    { runnerName: 'Sam', location: 'London, UK', avgMarginPct: 42, avgDaysToSell: 11, totalItems: 4, totalProfit: 2600, recommendation: 'Top ROI — prioritise sourcing here.' },
    { runnerName: 'Ada', location: 'Lagos, Nigeria', avgMarginPct: 36, avgDaysToSell: 18, totalItems: 2, totalProfit: 1200, recommendation: 'Solid margins but slower turnaround.' },
    { runnerName: 'Kevin', location: 'Nairobi, Kenya', avgMarginPct: 31, avgDaysToSell: 21, totalItems: 1, totalProfit: 600, recommendation: 'Monitor — limited volume so far.' },
  ],
};

// ---- LIVE: call Claude ----------------------------------------------------

async function callClaude(system: string, user: string): Promise<any> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const usage = response.usage;
  console.log(`[ai] tokens in=${usage.input_tokens} out=${usage.output_tokens}`);

  const text = response.content.find((b) => b.type === 'text');
  const raw = text && 'text' in text ? text.text : '';
  // Extract the first JSON object/array from the response, defensively.
  const match = raw.match(/[[{][\s\S]*[\]}]/);
  if (!match) throw new Error('AI did not return JSON');
  return JSON.parse(match[0]);
}

// ---- public API -----------------------------------------------------------

export async function getPricing(itemId: string): Promise<any> {
  const item = await prisma.item.findFirst({ where: { id: itemId, deletedAt: null } });
  if (!item) throw Object.assign(new Error('Item not found'), { status: 404 });

  const sold = await soldItems();
  if (sold.length < MIN_SOLD_FOR_AI) return EMPTY;
  if (isDemo()) return DEMO_PRICING;

  const summary = sold
    .slice(0, 30)
    .map((s) => `${s.brand} ${s.model} ${s.grade ?? ''} sold €${s.salePrice} in ${s.soldAt && s.stockAt ? daysBetween(s.soldAt, s.stockAt) : '?'}d`)
    .join('; ');
  return callClaude(
    'You are a pricing analyst for a luxury secondhand bag reseller on Vinted.',
    `Analyze the last 90 days of sales: ${summary}.\nNew item: ${item.brand} ${item.model} ${item.grade ?? ''} ${item.color ?? ''}.\nReturn JSON only: { daysToSell: number, recommendedPrice: number, confidence: "high"|"medium"|"low", reasoning: string }`,
  );
}

export async function getSourcing(): Promise<any> {
  const sold = await soldItems();
  if (sold.length < MIN_SOLD_FOR_AI) return EMPTY;
  if (isDemo()) return DEMO_SOURCING;

  const byRunner: Record<string, any> = {};
  for (const s of sold) {
    const name = s.runner?.name ?? 'Unknown';
    const r = (byRunner[name] ??= { runnerName: name, location: s.runner?.location ?? '', margins: [], days: [], totalItems: 0, totalProfit: 0 });
    r.totalItems++;
    r.totalProfit += s.netProfit ?? 0;
    const m = calcMarginPct(s);
    if (m != null) r.margins.push(m);
    if (s.soldAt && s.stockAt) r.days.push(daysBetween(s.soldAt, s.stockAt));
  }
  const runnerStats = JSON.stringify(Object.values(byRunner));
  return callClaude(
    'You are a supply chain analyst for a luxury reseller.',
    `Sales data grouped by runner: ${runnerStats}.\nReturn JSON: { priorityThisWeek: string, runners: [{ runnerName, location, avgMarginPct, avgDaysToSell, totalItems, totalProfit, recommendation }] } sorted by highest ROI.`,
  );
}

export async function getForecast(): Promise<any> {
  const sold = await soldItems();
  if (sold.length < MIN_SOLD_FOR_AI) return EMPTY;
  if (isDemo()) return DEMO_FORECAST;

  const now = new Date();
  const weekly: Record<number, number> = {};
  for (const s of sold) {
    if (!s.soldAt) continue;
    const wk = Math.floor(daysBetween(now, s.soldAt) / 7);
    if (wk < 13) weekly[wk] = (weekly[wk] ?? 0) + (s.salePrice ?? 0);
  }
  const inStock = await prisma.item.findMany({
    where: { status: { in: ['SOURCED', 'IN_TRANSIT', 'IN_STOCK'] }, deletedAt: null },
    select: { purchasePriceEur: true, sourcedAt: true, status: true },
  });
  const inventoryValue = inStock.reduce((sum, i) => sum + (i.purchasePriceEur ?? 0), 0);
  const stuck = inStock.filter((i) => i.status === 'SOURCED' && daysBetween(now, i.sourcedAt) > 14).length;

  return callClaude(
    'You are a financial forecasting analyst.',
    `Last 3 months weekly sales: ${JSON.stringify(weekly)}. Current inventory value: €${inventoryValue.toFixed(0)}. Items stuck >14 days: ${stuck}.\nReturn JSON: { forecastRevenue: number, forecastProfit: number, confidence: "high"|"medium"|"low", risks: string[], narrative: string }`,
  );
}
