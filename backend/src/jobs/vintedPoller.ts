import cron from 'node-cron';
import { runVintedSync } from '../services/vinted';
import { isDemo } from '../services/mode';

// Scrapes your Vinted wardrobe once a day at 06:00 to detect what sold, replacing
// the old 10-minute Gmail poll. In DEMO we don't auto-run (it would repeatedly
// "sell" seeded stock); use the manual Settings trigger.
//
// node-cron fires in the server's timezone. Hosts (e.g. Railway) usually run in
// UTC, so set CRON_TZ to your IANA zone (e.g. Europe/Amsterdam) to make "06:00"
// mean your local 6 AM. Defaults to UTC if unset.
const CRON_TZ = process.env.CRON_TZ || 'UTC';

export function startVintedPoller() {
  if (isDemo()) {
    console.log('[vintedPoller] DEMO mode — auto-scrape disabled (use manual sync).');
    return;
  }
  cron.schedule(
    '0 6 * * *',
    async () => {
      try {
        const r = await runVintedSync();
        console.log(
          `[vintedPoller] 06:00 scrape: ${r.listingsSeen} listings, ${r.salesFound} sales, ${r.matched} matched.`,
        );
      } catch (e) {
        console.error('[vintedPoller] error:', (e as Error).message);
      }
    },
    { timezone: CRON_TZ },
  );
  console.log(`[vintedPoller] scheduled daily at 06:00 ${CRON_TZ} (LIVE).`);
}
