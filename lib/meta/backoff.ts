export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Exponential backoff for Meta Graph API 429 / transient errors */
export async function withMetaBackoff(
  fn: () => Promise<Response>,
  maxAttempts = 5
): Promise<Response> {
  let attempt = 0;
  let last: Response | null = null;
  while (attempt < maxAttempts) {
    last = await fn();
    if (last.status !== 429 && last.status < 500) return last;
    const retryAfter = last.headers.get("retry-after");
    const waitMs = retryAfter
      ? Math.min(60_000, Number(retryAfter) * 1000 || 1000)
      : Math.min(30_000, 500 * 2 ** attempt);
    await sleep(waitMs);
    attempt += 1;
  }
  return last!;
}
