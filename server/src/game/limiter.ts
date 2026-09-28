/** Sliding-window attempt counter, kept in memory (it resets when the server restarts). */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private max: number, private windowMs: number) {}

  blocked(key: string, now = Date.now()) {
    return this.recent(key, now).length >= this.max;
  }

  hit(key: string, now = Date.now()) {
    const list = this.recent(key, now);
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 20_000) for (const k of [...this.hits.keys()]) this.recent(k, now);
  }

  clear(key: string) {
    this.hits.delete(key);
  }

  private recent(key: string, now: number) {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }
}

const MIN = 60_000;
/** Wrong passwords per adventurer name, and per address (guessing many names). */
export const loginFailsByName = new RateLimiter(8, 10 * MIN);
export const loginFailsByIp = new RateLimiter(30, 10 * MIN);
/** New accounts per address. */
export const signupsByIp = new RateLimiter(6, 60 * MIN);
