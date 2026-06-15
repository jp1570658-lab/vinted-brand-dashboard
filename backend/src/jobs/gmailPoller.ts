import cron from 'node-cron';
import { runGmailSync } from '../services/gmail';
import { isDemo } from '../services/mode';

// Polls Gmail every 10 minutes in LIVE mode. In DEMO we don't auto-poll (would
// repeatedly "sell" seeded stock); the manual Settings trigger is used instead.
export function startGmailPoller() {
  if (isDemo()) {
    console.log('[gmailPoller] DEMO mode — auto-poll disabled (use manual sync).');
    return;
  }
  cron.schedule('*/10 * * * *', async () => {
    try {
      const r = await runGmailSync();
      console.log(`[gmailPoller] synced: ${r.salesFound} sales, ${r.matched} matched.`);
    } catch (e) {
      console.error('[gmailPoller] error:', (e as Error).message);
    }
  });
  console.log('[gmailPoller] scheduled every 10 minutes (LIVE).');
}
