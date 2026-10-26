/*
  Token bucket per key: allows bursts of `burst` actions, then one every `interval` seconds.
*/
export function createLimiter ({ burst, interval }) {
  const buckets = new Map()

  return {
    // Returns { ok, wait, warn }: warn is true only the first time a key gets limited
    take (key, now = Date.now()) {
      const b = buckets.get(key) ?? { tokens: burst, last: now, warned: false }
      b.tokens = Math.min(burst, b.tokens + (now - b.last) / (interval * 1000))
      b.last = now
      buckets.set(key, b)

      if (b.tokens >= 1) {
        b.tokens -= 1
        b.warned = false
        return { ok: true }
      }
      const warn = !b.warned
      b.warned = true
      return { ok: false, warn, wait: Math.ceil((1 - b.tokens) * interval) }
    },

    // Forget buckets that have refilled completely
    prune (now = Date.now()) {
      for (const [key, b] of buckets) {
        if (b.tokens + (now - b.last) / (interval * 1000) >= burst) buckets.delete(key)
      }
    },

    get size () { return buckets.size }
  }
}

// ident@host, so changing nick doesn't reset anything
export const userKey = (e) => `${e.ident}@${e.hostname}`.toLowerCase()
