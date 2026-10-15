import cron from 'node-cron';
import { runGmailSync } from '../services/gmail';
import { isDemo } from '../services/mode';

// Polls Gmail every 10 minutes in LIVE mode for Vinted / Depop / Vestiaire sales and
// Western Union receipts. Only scheduled when Google OAuth is configured, and each
// run is skipped quietly until the operator has connected Gmail — so an unconfigured
// deployment never logs an error every 10 minutes. In DEMO the manual Settings
// trigger is used instead (auto-polling would keep "selling" stock).
export function startGmailPoller() {
  if (isDemo()) {
    console.log('[gmailPoller] DEMO mode — auto-poll disabled (use manual sync).');
    return;
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log('[gmailPoller] Google OAuth not configured — email detection disabled.');
    return;
  }
  cron.schedule('*/10 * * * *', async () => {
    try {
      const { isGmailConnected } = await import('../services/gmailLive');
      if (!(await isGmailConnected())) return;
      const r = await runGmailSync();
      if (r.salesFound || r.expensesCreated) {
        console.log(
          `[gmailPoller] ${r.salesFound} sale(s), ${r.matched} matched, ${r.expensesCreated} expense(s) imported.`,
        );
      }
    } catch (e) {
      console.error('[gmailPoller] error:', (e as Error).message);
    }
  });
  console.log('[gmailPoller] scheduled every 10 minutes (LIVE).');
}
