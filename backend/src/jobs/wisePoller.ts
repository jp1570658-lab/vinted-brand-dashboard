import cron from 'node-cron';
import { runWiseSync } from '../services/wise';
import { isDemo } from '../services/mode';

// Polls Wise every 6 hours in LIVE mode. DEMO uses the manual Settings trigger.
export function startWisePoller() {
  if (isDemo()) {
    console.log('[wisePoller] DEMO mode — auto-poll disabled (use manual sync).');
    return;
  }
  cron.schedule('0 */6 * * *', async () => {
    try {
      const r = await runWiseSync();
      console.log(`[wisePoller] synced: ${r.imported} new, ${r.duplicates} dupes.`);
    } catch (e) {
      console.error('[wisePoller] error:', (e as Error).message);
    }
  });
  console.log('[wisePoller] scheduled every 6 hours (LIVE).');
}
