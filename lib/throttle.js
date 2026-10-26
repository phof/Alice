/*
  Flood protection matching ircd's (IRCnet) client limits: a burst of `burst` lines,
  then one line every `interval` ms. The server penalises every line a client sends,
  and disconnects it for "Excess Flood" if it sends too much too fast.

  - say()/notice() lines wait in a queue. If the queue gets too long (i.e. someone is
    trying to make the bot flood), new lines are dropped, except ones sent with
    { important: true }, like reminders that can't be sent again.
  - Everything else sent with raw() (KICK, MODE, NAMES, PING...) and bot.sayNow() goes
    out immediately, so moderation never waits behind a long reply, but uses up the
    same allowance, so queued lines wait longer after it.
*/
export function throttle (bot, { burst = 4, interval = 2000, maxQueue = 50 } = {}) {
  const queue = []
  let tokens = burst
  let last = Date.now()
  let timer = null
  let dropped = 0
  let queueing = false // true while say/notice run, so their lines go to the queue

  const refill = () => {
    const now = Date.now()
    tokens = Math.min(burst, tokens + (now - last) / interval)
    last = now
  }

  const pump = () => {
    timer = null
    refill()
    while (tokens >= 1 && queue.length) {
      tokens -= 1
      queue.shift()()
    }
    if (queue.length) timer = setTimeout(pump, Math.ceil((1 - tokens) * interval))
  }

  const raw = bot.raw.bind(bot)
  bot.raw = (...args) => {
    if (queueing) {
      queue.push(() => raw(...args))
      if (!timer) pump()
      return
    }
    refill()
    tokens -= 1
    raw(...args)
  }

  const say = bot.say.bind(bot)
  bot.sayNow = (target, message) => say(target, String(message))

  for (const method of ['say', 'notice']) {
    const original = bot[method].bind(bot)
    bot[method] = (target, message, { important = false } = {}) => {
      if (message === undefined || message === null || message === '') return
      if (queue.length >= maxQueue && !important) {
        if (dropped++ === 0) console.warn('Outgoing queue full, dropping messages')
        return
      }
      dropped = 0
      queueing = true
      try {
        original(target, String(message))
      } finally {
        queueing = false
      }
    }
  }

  // Lines queued for a connection that's gone must not be sent on the next one
  bot.on('socket close', () => {
    queue.length = 0
    clearTimeout(timer)
    timer = null
  })
}
