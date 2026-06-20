import type { Item } from '../api/types';
import { eur, money, shortDate } from '../lib/format';
import { AgingBadge, isAged } from './AgingBadge';
import { ItemImage } from './ItemImage';
import { stageDateField } from '../lib/status';

interface Props {
  item: Item;
  onClick?: (item: Item) => void;
  /** show aging timer (Future Stock / In Transit) */
  showAging?: boolean;
  /** show listed price + quick edit (In Stock) */
  showListed?: boolean;
}

export function ItemCard({ item, onClick, showAging, showListed }: Props) {
  const aged = showAging && item.status === 'SOURCED' && isAged(item.sourcedAt);
  const stageDate = item[stageDateField(item.status)] as string | null;

  return (
    <button
      onClick={() => onClick?.(item)}
      className={`group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition hover:border-gold/50 ${
        aged ? 'border-red-500/60' : 'border-edge'
      }`}
    >
      <div className="relative aspect-square w-full bg-black/30">
        <ItemImage
          src={item.photoUrl}
          alt={`${item.brand} ${item.model}`}
          className="h-full w-full object-cover"
          fallbackClassName="flex h-full w-full items-center justify-center text-3xl text-neutral-700"
        />
        {item.grade && (
          <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-gold">
            {item.grade}
          </span>
        )}
        {item.vintedLikes != null && item.vintedLikes > 0 && (
          <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
            ❤ {item.vintedLikes}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="text-sm font-semibold leading-tight text-neutral-100">{item.brand}</div>
        <div className="truncate text-xs text-neutral-400">
          {item.model}
          {item.color ? ` · ${item.color}` : ''}
        </div>

        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-neutral-500">
            {money(item.purchasePrice, item.purchaseCurrency)}
          </span>
          {showListed && item.listedPrice != null && (
            <span className="font-semibold text-gold">{eur(item.listedPrice)}</span>
          )}
        </div>

        <div className="mt-1 flex items-center justify-between">
          {item.runner ? (
            <span className="truncate text-[11px] text-neutral-500">📦 {item.runner.name}</span>
          ) : (
            <span className="text-[11px] text-neutral-600">no runner</span>
          )}
          {showAging ? (
            <AgingBadge since={item.sourcedAt} location={item.runner?.location?.split(',')[0]} />
          ) : (
            <span className="text-[11px] text-neutral-600">{shortDate(stageDate)}</span>
          )}
        </div>
      </div>
    </button>
  );
}
