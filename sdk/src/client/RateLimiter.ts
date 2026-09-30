/**
 * Minimal async rate limiter that enforces a delay between requests.
 */
export class RateLimiter {
  private nextAvailableAt = 0;

  public constructor(private readonly minIntervalMs: number) {}

  /**
   * Waits until the client can issue the next request.
   */
  public async acquire(): Promise<void> {
    if (this.minIntervalMs <= 0) {
      return;
    }

    const now = Date.now();
    const waitMs = Math.max(this.nextAvailableAt - now, 0);
    this.nextAvailableAt = Math.max(this.nextAvailableAt, now) + this.minIntervalMs;

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
