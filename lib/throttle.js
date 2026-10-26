/*
  Simple flood protection: queues outgoing PRIVMSG/NOTICE lines so the
  bot doesn't get kicked for excess flood when sending many lines at once.
  If the queue gets too long (i.e. someone is trying to make the bot flood), new lines are dropped,
  except ones sent with { important: true }, like reminders that can't be sent again.
  bot.sayNow() skips the queue, for the rare messages that must go out first (flood warnings).
*/
export function throttle (bot, { delay = 300, maxQueue = 50 } = {}) {
  const queue = []
  let timer = null
  let dropped = 0

  const drain = () => {
    const next = queue.shift()
    if (!next) {
      timer = null
      return
    }
    next()
    timer = setTimeout(drain, delay)
  }

  bot.sayNow = bot.say.bind(bot)

  for (const method of ['say', 'notice']) {
    const original = bot[method].bind(bot)
    bot[method] = (target, message, { important = false } = {}) => {
      if (message === undefined || message === null || message === '') return
      if (queue.length >= maxQueue && !important) {
        if (dropped++ === 0) console.warn('Outgoing queue full, dropping messages')
        return
      }
      dropped = 0
      queue.push(() => original(target, String(message)))
      if (!timer) drain()
    }
  }
}
