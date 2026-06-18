export type ItemStatus = 'SOURCED' | 'IN_TRANSIT' | 'IN_STOCK' | 'SOLD';

export interface Runner {
  id: string;
  name: string;
  location: string;
  contact?: string | null;
  createdAt: string;
  _count?: { items: number };
}

export interface Item {
  id: string;
  brand: string;
  model: string;
  grade?: string | null;
  color?: string | null;
  photoUrl?: string | null;
  status: ItemStatus;
  sourcedAt: string;
  transitAt?: string | null;
  stockAt?: string | null;
  soldAt?: string | null;
  purchasePrice: number;
  purchaseCurrency: string;
  purchasePriceEur?: number | null;
  shippingCost?: number | null;
  customsFees?: number | null;
  listedPrice?: number | null;
  salePrice?: number | null;
  netProfit?: number | null;
  marginPct?: number | null;
  notes?: string | null;
  vintedOrderId?: string | null;
  saleSource?: string | null;
  runnerId?: string | null;
  runner?: Runner | null;
  createdAt: string;
  updatedAt: string;
}

export interface WiseTransaction {
  id: string;
  wiseId: string;
  date: string;
  amount: number;
  currency: string;
  amountEur?: number | null;
  description: string;
  category?: string | null;
  itemId?: string | null;
  item?: { id: string; brand: string; model: string } | null;
}

export interface Stats {
  revenueWeek: number;
  revenueMonth: number;
  revenueYear: number;
  netProfitMonth: number;
  inventoryValue: number;
  countByStatus: Record<ItemStatus, number>;
}

export interface MonthPoint {
  month: string;
  label: string;
  revenue: number;
  profit: number;
  units: number;
}

export interface BreakdownRow {
  key: string;
  units: number;
  revenue: number;
  profit: number;
  avgMarginPct: number | null;
  avgDaysToSell: number | null;
}

export interface Analytics {
  totals: {
    units: number;
    revenue: number;
    profit: number;
    avgMarginPct: number | null;
    avgDaysToSell: number | null;
  };
  monthly: MonthPoint[];
  byBrand: BreakdownRow[];
  byRunner: BreakdownRow[];
  generatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  data: T[];
  pagination: Pagination;
}

export interface HealthInfo {
  status: string;
  mode: 'DEMO' | 'LIVE';
  timestamp: string;
}
