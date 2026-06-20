import { useState } from 'react';

interface Props {
  src?: string | null;
  alt: string;
  /** classes for the <img> */
  className?: string;
  /** classes for the placeholder shown when there's no image (or it fails to load) */
  fallbackClassName?: string;
  emoji?: string;
}

/**
 * Item photo that ALWAYS shows something. If there's no src, or the image 404s/fails
 * (e.g. an expired Vinted CDN URL), it falls back to a clean placeholder instead of
 * the browser's broken-image icon.
 */
export function ItemImage({ src, alt, className, fallbackClassName, emoji = '👜' }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className={fallbackClassName}>{emoji}</div>;
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
