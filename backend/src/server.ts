import 'dotenv/config';
import { createApp } from './app';
import { APP_MODE } from './services/mode';
import { startVintedPoller } from './jobs/vintedPoller';
import { startWisePoller } from './jobs/wisePoller';
import { startAgingChecker } from './jobs/agingChecker';

const PORT = Number(process.env.PORT) || 3001;

const app = createApp();

app.listen(PORT, () => {
  console.log(`[server] Vinted Dashboard API listening on http://localhost:${PORT}`);
  console.log(`[server] Mode: ${APP_MODE}`);
  // Sales are now detected by scraping the Vinted wardrobe daily at 06:00,
  // replacing the old Gmail poller. The manual Gmail sync route (/api/sync/gmail)
  // is kept as a fallback but no longer runs automatically.
  startVintedPoller();
  startWisePoller();
  startAgingChecker();
});
