import { PrismaClient, ItemStatus } from '@prisma/client';

const prisma = new PrismaClient();

// EUR conversion map (mirrors services/currency.ts; kept inline so seed has no app deps).
const FX: Record<string, number> = { NGN: 0.00055, KES: 0.0069, EUR: 1.0, GBP: 1.17 };
const toEur = (amount: number, currency: string) => +(amount * (FX[currency] ?? 1)).toFixed(2);

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function main() {
  console.log('[seed] clearing existing data…');
  await prisma.wiseTransaction.deleteMany();
  await prisma.item.deleteMany();
  await prisma.runner.deleteMany();
  await prisma.gmailSync.deleteMany();

  console.log('[seed] creating runners…');
  const ada = await prisma.runner.create({
    data: { name: 'Ada', location: 'Lagos, Nigeria', contact: '+234 800 000 0001' },
  });
  const kev = await prisma.runner.create({
    data: { name: 'Kevin', location: 'Nairobi, Kenya', contact: '+254 700 000 002' },
  });
  const sam = await prisma.runner.create({
    data: { name: 'Sam', location: 'London, UK', contact: '+44 7700 900003' },
  });

  type Seed = {
    brand: string;
    model: string;
    grade: string;
    color: string;
    status: ItemStatus;
    purchasePrice: number;
    purchaseCurrency: string;
    runnerId: string;
    ageDays: number; // how long ago it was SOURCED
    listedPrice?: number;
    salePrice?: number;
    shippingCost?: number;
    customsFees?: number;
    saleSource?: string;
  };

  const seeds: Seed[] = [
    // SOURCED (one fresh, one AGED >14 days to exercise alerts)
    {
      brand: 'Louis Vuitton', model: 'Neverfull MM', grade: 'A', color: 'Monogram',
      status: ItemStatus.SOURCED, purchasePrice: 145000, purchaseCurrency: 'NGN',
      runnerId: ada.id, ageDays: 3,
    },
    {
      brand: 'Gucci', model: 'Marmont Small', grade: 'B', color: 'Black',
      status: ItemStatus.SOURCED, purchasePrice: 38000, purchaseCurrency: 'KES',
      runnerId: kev.id, ageDays: 19, // AGED → should flag red + banner
    },
    // IN_TRANSIT
    {
      brand: 'Prada', model: 'Re-Edition 2005', grade: 'A', color: 'Nylon Black',
      status: ItemStatus.IN_TRANSIT, purchasePrice: 210, purchaseCurrency: 'GBP',
      runnerId: sam.id, ageDays: 9, shippingCost: 22,
    },
    // IN_STOCK
    {
      brand: 'Chanel', model: 'Classic Flap Medium', grade: 'A', color: 'Caviar Beige',
      status: ItemStatus.IN_STOCK, purchasePrice: 1850, purchaseCurrency: 'GBP',
      runnerId: sam.id, ageDays: 25, shippingCost: 30, listedPrice: 3200,
    },
    {
      brand: 'Dior', model: 'Saddle Bag', grade: 'B', color: 'Oblique',
      status: ItemStatus.IN_STOCK, purchasePrice: 168000, purchaseCurrency: 'NGN',
      runnerId: ada.id, ageDays: 12, shippingCost: 18, listedPrice: 1450,
    },
    // SOLD (several, so AI features have a sales history later)
    {
      brand: 'Louis Vuitton', model: 'Speedy 30', grade: 'A', color: 'Damier Ebene',
      status: ItemStatus.SOLD, purchasePrice: 130000, purchaseCurrency: 'NGN',
      runnerId: ada.id, ageDays: 40, shippingCost: 20, listedPrice: 780, salePrice: 760,
      saleSource: 'AUTO_GMAIL',
    },
    {
      brand: 'Gucci', model: 'Dionysus', grade: 'A', color: 'GG Supreme',
      status: ItemStatus.SOLD, purchasePrice: 52000, purchaseCurrency: 'KES',
      runnerId: kev.id, ageDays: 33, shippingCost: 16, listedPrice: 980, salePrice: 940,
      saleSource: 'MANUAL',
    },
    {
      brand: 'Prada', model: 'Galleria Saffiano', grade: 'A', color: 'Cammeo',
      status: ItemStatus.SOLD, purchasePrice: 240, purchaseCurrency: 'GBP',
      runnerId: sam.id, ageDays: 28, shippingCost: 24, listedPrice: 690, salePrice: 700,
      saleSource: 'AUTO_GMAIL',
    },
    {
      brand: 'Chanel', model: 'WOC', grade: 'B', color: 'Black Lambskin',
      status: ItemStatus.SOLD, purchasePrice: 900, purchaseCurrency: 'GBP',
      runnerId: sam.id, ageDays: 50, shippingCost: 28, listedPrice: 1600, salePrice: 1520,
      saleSource: 'MANUAL',
    },
    {
      brand: 'Hermès', model: 'Garden Party', grade: 'A', color: 'Etoupe',
      status: ItemStatus.SOLD, purchasePrice: 1200, purchaseCurrency: 'GBP',
      runnerId: sam.id, ageDays: 60, shippingCost: 26, listedPrice: 2100, salePrice: 2050,
      saleSource: 'AUTO_GMAIL',
    },
  ];

  console.log('[seed] creating items…');
  for (const s of seeds) {
    const sourcedAt = daysAgo(s.ageDays);
    const purchasePriceEur = toEur(s.purchasePrice, s.purchaseCurrency);

    // Stage timestamps derived from the item's lifecycle.
    const transitAt =
      s.status === ItemStatus.IN_TRANSIT ||
      s.status === ItemStatus.IN_STOCK ||
      s.status === ItemStatus.SOLD
        ? daysAgo(Math.max(0, s.ageDays - 3))
        : null;
    const stockAt =
      s.status === ItemStatus.IN_STOCK || s.status === ItemStatus.SOLD
        ? daysAgo(Math.max(0, s.ageDays - 6))
        : null;
    const soldAt = s.status === ItemStatus.SOLD ? daysAgo(Math.max(0, s.ageDays - 14)) : null;

    const netProfit =
      s.status === ItemStatus.SOLD && s.salePrice != null
        ? +(
            s.salePrice -
            purchasePriceEur -
            (s.shippingCost ?? 0) -
            (s.customsFees ?? 0)
          ).toFixed(2)
        : null;

    await prisma.item.create({
      data: {
        brand: s.brand,
        model: s.model,
        grade: s.grade,
        color: s.color,
        status: s.status,
        sourcedAt,
        transitAt,
        stockAt,
        soldAt,
        purchasePrice: s.purchasePrice,
        purchaseCurrency: s.purchaseCurrency,
        purchasePriceEur,
        shippingCost: s.shippingCost ?? null,
        customsFees: s.customsFees ?? null,
        listedPrice: s.listedPrice ?? null,
        salePrice: s.salePrice ?? null,
        netProfit,
        saleSource: s.saleSource ?? null,
        runnerId: s.runnerId,
      },
    });
  }

  const counts = await prisma.item.groupBy({ by: ['status'], _count: true });
  console.log('[seed] done. Items by status:');
  for (const c of counts) console.log(`  ${c.status}: ${c._count}`);
  console.log(`[seed] runners: 3`);
}

main()
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
