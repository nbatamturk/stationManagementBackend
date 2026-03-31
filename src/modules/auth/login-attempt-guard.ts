import { env } from '../../config/env';

type AttemptState = {
  blockedUntil: number | null;
  count: number;
  lastAttemptAt: number;
  windowStartedAt: number;
};

type AttemptResult = {
  attempts: number;
  blocked: boolean;
  retryAfterSeconds: number | null;
};

const toRetryAfterSeconds = (blockedUntil: number, now: number) =>
  Math.max(1, Math.ceil((blockedUntil - now) / 1000));

export class LoginAttemptGuard {
  private readonly attempts = new Map<string, AttemptState>();

  private lastPrunedAt = 0;

  constructor(
    private readonly options: {
      blockDurationMs: number;
      maxAttempts: number;
      windowMs: number;
    },
  ) {}

  getStatus(key: string): AttemptResult {
    const now = Date.now();
    this.prune(now);

    const state = this.attempts.get(key);

    if (!state) {
      return {
        attempts: 0,
        blocked: false,
        retryAfterSeconds: null,
      };
    }

    if (state.blockedUntil && state.blockedUntil > now) {
      return {
        attempts: state.count,
        blocked: true,
        retryAfterSeconds: toRetryAfterSeconds(state.blockedUntil, now),
      };
    }

    if (now - state.windowStartedAt >= this.options.windowMs) {
      this.attempts.delete(key);

      return {
        attempts: 0,
        blocked: false,
        retryAfterSeconds: null,
      };
    }

    return {
      attempts: state.count,
      blocked: false,
      retryAfterSeconds: null,
    };
  }

  recordFailure(key: string): AttemptResult {
    const now = Date.now();
    this.prune(now);

    const current = this.attempts.get(key);
    const resetWindow = !current || (!current.blockedUntil && now - current.windowStartedAt >= this.options.windowMs);

    const nextState: AttemptState = resetWindow
      ? {
          blockedUntil: null,
          count: 1,
          lastAttemptAt: now,
          windowStartedAt: now,
        }
      : {
          blockedUntil: current?.blockedUntil ?? null,
          count: (current?.count ?? 0) + 1,
          lastAttemptAt: now,
          windowStartedAt: current?.windowStartedAt ?? now,
        };

    if (!nextState.blockedUntil && nextState.count >= this.options.maxAttempts) {
      nextState.blockedUntil = now + this.options.blockDurationMs;
    }

    this.attempts.set(key, nextState);

    return {
      attempts: nextState.count,
      blocked: nextState.blockedUntil !== null && nextState.blockedUntil > now,
      retryAfterSeconds:
        nextState.blockedUntil !== null && nextState.blockedUntil > now
          ? toRetryAfterSeconds(nextState.blockedUntil, now)
          : null,
    };
  }

  reset(key: string) {
    this.attempts.delete(key);
  }

  private prune(now: number) {
    if (now - this.lastPrunedAt < this.options.windowMs) {
      return;
    }

    for (const [key, state] of this.attempts.entries()) {
      const isExpiredBlock = state.blockedUntil !== null && state.blockedUntil <= now;
      const isExpiredWindow = now - state.lastAttemptAt >= this.options.windowMs;

      if (isExpiredBlock || isExpiredWindow) {
        this.attempts.delete(key);
      }
    }

    this.lastPrunedAt = now;
  }
}

export const loginAttemptGuard = new LoginAttemptGuard({
  blockDurationMs: env.LOGIN_RATE_LIMIT_BLOCK_MS,
  maxAttempts: env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
});
