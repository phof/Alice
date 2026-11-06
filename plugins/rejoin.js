/*
  Joins the configured channels and keeps the bot in them. A rejected JOIN is retried
  with backoff, and a periodic check rejoins any configured channel the bot isn't in
  (kicked, a ban that was lifted, a missed JOIN echo..).

  irc-framework reports 471/473/474/475 as 'irc error', but has no handler for 437
  (IRCnet's channel delay after a netsplit emptied the channel) or 477, so those
  arrive as 'unknown command' and would otherwise be dropped without a trace.
*/
const JOIN_ERRORS = new Set(['channel_is_full', 'invite_only_channel', 'banned_from_channel', 'bad_channel_key'])
const UNHANDLED = { 437: 'unavailable_resource', 477: 'need_registered_nick' }

export default function ({ bot, config }) {
  const interval = config.rejoin.interval * 1000
  const firstRetry = Math.min(30_000, interval)
  const isMe = (nick) => bot.caseCompare(nick, bot.user.nick)

  const configured = new Map(config.channels.map(c => [bot.caseLower(c), c]))
  // Configured channels we want to be in: an @part takes one out until it's joined again
  const wanted = new Map(configured)
  const joined = new Set()
  // Per channel: failures in a row, the pending retry timer, when we last sent a JOIN
  const state = new Map()
  const get = (key) => state.get(key) ?? state.set(key, { failures: 0, timer: null, lastJoin: 0 }).get(key)

  function join (channel) {
    get(bot.caseLower(channel)).lastJoin = Date.now()
    bot.join(channel)
  }

  function reset () {
    state.forEach(s => clearTimeout(s.timer))
    state.clear()
    joined.clear()
  }

  function failed (channel, reason) {
    const key = bot.caseLower(channel)
    if (!configured.has(key) || joined.has(key)) return
    // We just tried to join it, so we do want to be there (even mid keep_op cycle)
    wanted.set(key, configured.get(key))
    const s = get(key)
    s.failures++
    const delay = Math.min(firstRetry * 2 ** (s.failures - 1), interval)
    console.log(`Could not join ${channel} (${reason}), retrying in ${Math.round(delay / 1000)}s`)
    clearTimeout(s.timer)
    s.timer = setTimeout(() => {
      s.timer = null
      if (bot.connected && wanted.has(key) && !joined.has(key)) join(wanted.get(key))
    }, delay)
    s.timer.unref?.()
  }

  // Any configured channel we're not in and aren't already waiting on gets one JOIN per interval
  function check (now = Date.now()) {
    if (!bot.connected) return
    wanted.forEach((channel, key) => {
      if (joined.has(key)) return
      const s = get(key)
      if (s.timer || now - s.lastJoin < interval) return
      console.log(`Not in ${channel}, rejoining`)
      join(channel)
    })
  }

  bot.on('registered', () => {
    reset()
    configured.forEach((channel, key) => wanted.set(key, channel))
    wanted.forEach(join)
  })
  bot.on('socket close', reset)
  bot.on('close', reset)

  bot.on('join', (e) => {
    if (!isMe(e.nick)) return
    const key = bot.caseLower(e.channel)
    joined.add(key)
    if (configured.has(key)) wanted.set(key, configured.get(key))
    clearTimeout(state.get(key)?.timer)
    state.delete(key)
  })
  bot.on('part', (e) => {
    if (!isMe(e.nick)) return
    joined.delete(bot.caseLower(e.channel))
    wanted.delete(bot.caseLower(e.channel))
  })
  bot.on('kick', (e) => { if (isMe(e.kicked)) joined.delete(bot.caseLower(e.channel)) })

  bot.on('irc error', (e) => { if (JOIN_ERRORS.has(e.error) && e.channel) failed(e.channel, e.reason ?? e.error) })
  bot.on('unknown command', (command) => {
    const error = UNHANDLED[command.command]
    if (!error) return
    const [, channel, reason] = command.params
    console.error('IRC error', error, channel, reason ?? '')
    if (bot.network.isChannelName(channel)) failed(channel, reason ?? error)
  })

  const timer = setInterval(check, interval)
  timer.unref()

  return {
    name: 'Rejoin',
    check,
    stop () {
      clearInterval(timer)
      reset()
    }
  }
}
