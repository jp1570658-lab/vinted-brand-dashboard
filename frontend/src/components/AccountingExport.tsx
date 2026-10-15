import { useState } from 'react';

const thisMonth = () => new Date().toISOString().slice(0, 7);
const yearEnd = () => `${new Date().getFullYear()}-12-31`;

/**
 * One-click accounting exports for the accountant (CSV, opens in Excel):
 * monthly Sales Journal, monthly Purchases & Logistics Journal and the closing
 * inventory valuation (31 December by default). Plain links — the session
 * cookie authorises the download.
 */
export function AccountingExport() {
  const [month, setMonth] = useState(thisMonth());
  const [date, setDate] = useState(yearEnd());

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-neutral-500">
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input mt-0.5 block"
          />
        </label>
        <a
          href={month ? `/api/export/sales?month=${month}` : undefined}
          download
          className="btn-ghost"
        >
          ⬇ Sales Journal
        </a>
        <a
          href={month ? `/api/export/purchases?month=${month}` : undefined}
          download
          className="btn-ghost"
        >
          ⬇ Purchases &amp; Logistics
        </a>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-neutral-500">
          Closing inventory on
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input mt-0.5 block"
          />
        </label>
        <a href={date ? `/api/export/inventory?date=${date}` : undefined} download className="btn-ghost">
          ⬇ Stock valuation
        </a>
      </div>
      <p className="text-[11px] text-neutral-600">
        CSV for Excel (Belgian format: “;” separator, decimal comma). Sales list gross, platform fees
        and net received; purchases list every Wise / Western Union / cash expense with fees; stock is
        valued at acquisition cost.
      </p>
    </div>
  );
}
