import path from 'path';

/**
 * Directory where uploaded item photos are stored AND served from.
 *
 * On an ephemeral host (e.g. Railway) the container filesystem is wiped on every
 * redeploy/restart, which deletes uploaded photos. Point UPLOADS_DIR at a mounted
 * persistent volume so the files survive. Falls back to backend/uploads for local dev.
 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(__dirname, '../../uploads');
