import type { ItemStatus } from '../api/types';

export const STATUS_LABEL: Record<ItemStatus, string> = {
  SOURCED: 'Future Stock',
  IN_TRANSIT: 'In Transit',
  IN_STOCK: 'In Stock',
  SOLD: 'Sold',
};

// Tailwind classes for status badges.
export const STATUS_BADGE: Record<ItemStatus, string> = {
  SOURCED: 'bg-status-sourced/15 text-status-sourced border-status-sourced/30',
  IN_TRANSIT: 'bg-status-transit/15 text-status-transit border-status-transit/30',
  IN_STOCK: 'bg-status-stock/15 text-status-stock border-status-stock/30',
  SOLD: 'bg-status-sold/15 text-status-sold border-status-sold/30',
};

export const STATUS_ORDER: ItemStatus[] = ['SOURCED', 'IN_TRANSIT', 'IN_STOCK', 'SOLD'];

// The timestamp that marks when the item entered its current stage.
export function stageDateField(status: ItemStatus): keyof import('../api/types').Item {
  switch (status) {
    case 'SOURCED':
      return 'sourcedAt';
    case 'IN_TRANSIT':
      return 'transitAt';
    case 'IN_STOCK':
      return 'stockAt';
    case 'SOLD':
      return 'soldAt';
  }
}
