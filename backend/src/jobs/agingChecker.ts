import cron from 'node-cron';
import { sendAgingAlert } from '../services/alerts';

// Daily at 08:00 — email an alert if any SOURCED item is over 14 days old.
export function startAgingChecker() {
  cron.schedule('0 8 * * *', async () => {
    try {
      const r = await sendAgingAlert();
      console.log(`[agingChecker] ${r.sent ? `alerted on ${r.count} item(s)` : 'no aged items'}`);
    } catch (e) {
      console.error('[agingChecker] error:', (e as Error).message);
    }
  });
  console.log('[agingChecker] scheduled daily at 08:00.');
}
