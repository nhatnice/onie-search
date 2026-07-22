import type { DbOrTx } from '@/db';
import {
  pickActiveScraperAccount,
  touchScraperAccount,
  type ScraperAccount,
} from '@/features/social/api/queries';

export type RotationConfig = {
  rotateEveryN: number;
  singleAccountWarned?: boolean;
};

export type RotationDecision = {
  shouldRotate: boolean;
  reason: 'threshold' | 'no-other-account';
  nextAccount: ScraperAccount | null;
  insertedSinceRotate: number;
};

// ponytail: generic round-robin account rotator for any platform — drives scraper sessions
// in long-running crawl jobs to avoid per-account rate limits.
export class RobinRotator {
  private current: ScraperAccount | null = null;
  private insertedSinceRotate = 0;
  private lastSingleWarn = 0;

  constructor(
    private db: DbOrTx,
    private platformId: string,
    private cfg: RotationConfig,
  ) {}

  async bind(account: ScraperAccount): Promise<void> {
    this.current = account;
    this.insertedSinceRotate = 0;
    await touchScraperAccount(this.db, account.account.id);
  }

  currentAccount(): ScraperAccount | null {
    return this.current;
  }

  record(n: number): void {
    this.insertedSinceRotate += n;
  }

  remainingBeforeRotate(): number {
    return Math.max(0, this.cfg.rotateEveryN - this.insertedSinceRotate);
  }

  async decide(): Promise<RotationDecision> {
    if (this.insertedSinceRotate < this.cfg.rotateEveryN) {
      return {
        shouldRotate: false,
        reason: 'threshold',
        nextAccount: null,
        insertedSinceRotate: this.insertedSinceRotate,
      };
    }
    const next = await pickActiveScraperAccount(this.db, this.platformId, this.current?.account.id);
    if (!next) {
      const now = Date.now();
      if (!this.cfg.singleAccountWarned || now - this.lastSingleWarn > 60_000) {
        console.warn(
          `[robin] threshold reached (${this.insertedSinceRotate}/${this.cfg.rotateEveryN}) — chỉ có 1 account active, skip rotation`,
        );
        this.cfg.singleAccountWarned = true;
        this.lastSingleWarn = now;
      }
      this.insertedSinceRotate = 0;
      return {
        shouldRotate: false,
        reason: 'no-other-account',
        nextAccount: null,
        insertedSinceRotate: 0,
      };
    }
    return {
      shouldRotate: true,
      reason: 'threshold',
      nextAccount: next,
      insertedSinceRotate: this.insertedSinceRotate,
    };
  }

  async applySwap(next: ScraperAccount): Promise<void> {
    console.warn(`[robin] rotating: #${this.current?.account.id} → #${next.account.id}`);
    this.current = next;
    this.insertedSinceRotate = 0;
    await touchScraperAccount(this.db, next.account.id);
  }
}
