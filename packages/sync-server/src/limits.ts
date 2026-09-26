type Clock = { now: () => number };

class Sweeper {
  private last = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly everyMs: number,
    private readonly clock: Clock,
  ) {}

  due(): boolean {
    const now = this.clock.now();
    if (now - this.last < this.everyMs) return false;
    this.last = now;
    return true;
  }
}

export class FailureLimiter {
  private readonly failures = new Map<string, number[]>();
  private readonly blockedUntil = new Map<string, number>();
  private readonly sweeper: Sweeper;

  constructor(private readonly opts: { max: number; windowMs: number; blockMs: number; now: () => number }) {
    this.sweeper = new Sweeper(opts.windowMs, opts);
  }

  get size(): number {
    return this.failures.size + this.blockedUntil.size;
  }

  blocked(key: string): boolean {
    const until = this.blockedUntil.get(key);
    if (until === undefined) return false;
    if (until > this.opts.now()) return true;
    this.blockedUntil.delete(key);
    return false;
  }

  fail(key: string): void {
    this.sweep();
    const now = this.opts.now();
    const recent = this.recent(key, now);
    recent.push(now);
    if (recent.length >= this.opts.max) {
      this.blockedUntil.set(key, now + this.opts.blockMs);
      this.failures.delete(key);
      return;
    }
    this.failures.set(key, recent);
  }

  private recent(key: string, now: number): number[] {
    return (this.failures.get(key) ?? []).filter((t) => t > now - this.opts.windowMs);
  }

  private sweep(): void {
    if (!this.sweeper.due()) return;
    const now = this.opts.now();
    for (const [key, until] of this.blockedUntil) if (until <= now) this.blockedUntil.delete(key);
    for (const key of this.failures.keys()) if (this.recent(key, now).length === 0) this.failures.delete(key);
  }
}

export class RateWindow {
  private readonly hits = new Map<string, number[]>();
  private readonly sweeper: Sweeper;

  constructor(private readonly opts: { limit: number; windowMs: number; now: () => number }) {
    this.sweeper = new Sweeper(opts.windowMs, opts);
  }

  get size(): number {
    return this.hits.size;
  }

  take(key: string): boolean {
    this.sweep();
    const now = this.opts.now();
    const recent = this.recent(key, now);
    if (recent.length >= this.opts.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  private recent(key: string, now: number): number[] {
    return (this.hits.get(key) ?? []).filter((t) => t > now - this.opts.windowMs);
  }

  private sweep(): void {
    if (!this.sweeper.due()) return;
    const now = this.opts.now();
    for (const key of this.hits.keys()) if (this.recent(key, now).length === 0) this.hits.delete(key);
  }
}
