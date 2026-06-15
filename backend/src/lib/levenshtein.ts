/** Levenshtein distance + a 0..1 similarity ratio, used to match sale emails to items. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n];
}

/** Similarity in [0,1]. 1 = identical. Case-insensitive, trimmed. */
export function similarity(a: string, b: string): number {
  const x = (a || '').toLowerCase().trim();
  const y = (b || '').toLowerCase().trim();
  if (!x && !y) return 1;
  const maxLen = Math.max(x.length, y.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(x, y) / maxLen;
}
