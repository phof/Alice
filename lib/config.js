const env = process.env

const list = (value) => (value || '').split(',').map(s => s.trim()).filter(Boolean)
const bool = (value) => /^(1|true|yes|on)$/i.test(value || '')
// Unset, empty ("FLOOD_LINES=") or invalid values fall back to the default
export const num = (value, fallback) => {
  const n = Number(value)
  return value?.trim() && Number.isFinite(n) ? n : fallback
}

const tls = bool(env.BOT_TLS)

export default {
  irc: {
    host: env.BOT_SERVER || 'hostsailor.ircnet.nl',
    port: num(env.BOT_PORT, tls ? 6697 : 6667),
    tls,
    password: env.BOT_PASSWORD || undefined,
    account: env.BOT_SASL_ACCOUNT
      ? { account: env.BOT_SASL_ACCOUNT, password: env.BOT_SASL_PASSWORD || '' }
      : undefined,
    nick: env.BOT_NICK || 'Alice',
    username: env.BOT_USERNAME || 'alice',
    gecos: env.BOT_REALNAME || 'What is a Caucus-race?'
  },
  channels: list(env.BOT_CHANNELS || '#wonderland'),
  // Extra hostmask globs allowed to use @commands, on top of the owner and admins in Redis
  admins: list(env.BOT_ADMINS),
  // Print a new claim code at startup even if the bot already has an owner
  reclaim: bool(env.BOT_RECLAIM),
  redisUrl: env.REDIS_URL || 'redis://localhost:6379',
  // Minimum seconds between two memory replies in the same channel
  memoryCooldown: num(env.MEMORY_COOLDOWN, 30),
  // Commands per user: bursts of `burst`, then one every `interval` seconds
  rateLimit: {
    burst: num(env.RATE_LIMIT_BURST, 5),
    interval: num(env.RATE_LIMIT_INTERVAL, 6)
  },
  flood: {
    enabled: !/^(0|false|no|off)$/i.test(env.FLOOD_PROTECTION || ''),
    // more than `lines` messages in `seconds` is flooding
    lines: num(env.FLOOD_LINES, 8),
    seconds: num(env.FLOOD_SECONDS, 6),
    // the same message `repeats` times in a minute is spam
    repeats: num(env.FLOOD_REPEATS, 4),
    banMinutes: num(env.FLOOD_BAN_MINUTES, 15)
  },
  greet: {
    enabled: !/^(0|false|no|off)$/i.test(env.GREET || ''),
    // greet people again when they come back after this many days away
    afterDays: num(env.GREET_AFTER_DAYS, 3)
  },
  defaultTopic: env.DEFAULT_TOPIC || 'Imagination is the only weapon in the war against reality',
  quitMessage: env.DEFAULT_DISCONNECT || "We're all mad here."
}
