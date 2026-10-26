/*
  Simple flood protection: queues outgoing PRIVMSG/NOTICE lines so the
  bot doesn't get kicked for excess flood when sending many lines at once.
*/
export function throttle (bot, delay = 300) {
  const queue = []
  let timer = null

  const drain = () => {
    const next = queue.shift()
    if (!next) {
      timer = null
      return
    }
    next()
    timer = setTimeout(drain, delay)
  }

  for (const method of ['say', 'notice']) {
    const original = bot[method].bind(bot)
    bot[method] = (target, message) => {
      if (message === undefined || message === null || message === '') return
      queue.push(() => original(target, String(message)))
      if (!timer) drain()
    }
  }
}
