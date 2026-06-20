import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { UPLOADS_DIR } from './uploads';

/**
 * Cache a Vinted listing photo onto our own persistent volume so the dashboard
 * ALWAYS has a working image.
 *
 * Vinted serves photos from a CDN whose URLs rotate/expire over time — storing the
 * raw remote URL means the image silently 404s later and the card shows a broken
 * placeholder. Instead we download each photo once into UPLOADS_DIR (a mounted
 * persistent volume in production) and serve it from `/uploads/...`, exactly like a
 * manually uploaded photo. It then survives independently of Vinted.
 *
 * Idempotent: if the file already exists we reuse it (no re-download). Downloads hit
 * the image CDN, NOT the gated /api endpoints, so they don't risk the auth/bot
 * protection the wardrobe scrape depends on. On any failure we fall back to the
 * remote URL so there's still something to show.
 *
 * @returns a local `/uploads/<file>` path, or the original remoteUrl as a fallback.
 */
export async function cacheVintedImage(
  vintedItemId: string,
  remoteUrl: string | null,
): Promise<string | null> {
  if (!remoteUrl) return null;

  // Already a local path (re-sync of an item we cached before) — leave it.
  if (remoteUrl.startsWith('/uploads/')) return remoteUrl;

  const ext = guessExt(remoteUrl);
  const filename = `vinted_${vintedItemId}${ext}`;
  const dest = path.join(UPLOADS_DIR, filename);
  const localPath = `/uploads/${filename}`;

  try {
    if (fs.existsSync(dest)) return localPath; // cached on a previous run
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    const res = await axios.get<ArrayBuffer>(remoteUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      // A browsery UA + referer keeps the CDN from rejecting the hotlink.
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Referer: 'https://www.vinted.com/',
      },
    });
    fs.writeFileSync(dest, Buffer.from(res.data));
    return localPath;
  } catch {
    // Couldn't cache it — fall back to the remote URL so the card still shows something.
    return remoteUrl;
  }
}

function guessExt(url: string): string {
  const m = url.split('?')[0].match(/\.(jpe?g|png|webp|gif)$/i);
  return m ? `.${m[1].toLowerCase()}` : '.jpg';
}
