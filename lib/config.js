const env = process.env

const list = (value) => (value || '').split(',').map(s => s.trim()).filter(Boolean)
const bool = (value) => /^(1|true|yes|on)$/i.test(value || '')

const tls = bool(env.BOT_TLS)

export default {
  irc: {
    host: env.BOT_SERVER || 'localhost',
    port: Number(env.BOT_PORT) || (tls ? 6697 : 6667),
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
  // Who may use @commands: hostmask globs and/or services accounts (needs IRCv3 account-tag)
  admins: list(env.BOT_ADMINS),
  adminAccounts: list(env.BOT_ADMIN_ACCOUNTS).map(a => a.toLowerCase()),
  redisUrl: env.REDIS_URL || 'redis://localhost:6379',
  defaultTopic: env.DEFAULT_TOPIC || 'Imagination is the only weapon in the war against reality',
  quitMessage: env.DEFAULT_DISCONNECT || "We're all mad here."
}
