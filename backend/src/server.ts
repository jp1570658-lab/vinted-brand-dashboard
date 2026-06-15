import 'dotenv/config';
import { createApp } from './app';
import { APP_MODE } from './services/mode';
import { startGmailPoller } from './jobs/gmailPoller';

const PORT = Number(process.env.PORT) || 3001;

const app = createApp();

app.listen(PORT, () => {
  console.log(`[server] Vinted Dashboard API listening on http://localhost:${PORT}`);
  console.log(`[server] Mode: ${APP_MODE}`);
  startGmailPoller();
});
