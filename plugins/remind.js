import { randomUUID } from 'node:crypto'
import { parseDuration, formatDuration, ago } from '../lib/duration.js'
import { userKey } from '../lib/ratelimit.js'

const KEY = 'reminders'
const MAX_PER_USER = 20
const MAX_DELAY = 365 * 24 * 3600 * 1000
const POLL = 5000

/*
  Reminders live in a Redis sorted set scored by due time, so they survive restarts.
  A reminder that comes due while the bot is offline is delivered once it's back.
*/
export default function ({ bot, db }) {
  async function deliverDue (now = Date.now()) {
    if (!db.isReady || !bot.connected) return
    for (const raw of await db.zRangeByScore(KEY, 0, now)) {
      // ZREM tells us whether we're the ones delivering it
      if (!await db.zRem(KEY, raw)) continue
      const r = JSON.parse(raw)
      bot.say(r.target, `${r.nick}: reminder from ${ago(r.created, now)}: ${r.text}`, { important: true })
    }
  }

  const timer = setInterval(() => deliverDue().catch(err => console.error('Reminder delivery failed', err.message)), POLL)
  timer.unref()

  return {
    name: 'Reminders',
    deliverDue,
    commands: [{
      command: '!remind',
      usage: '!remind <in 2h|1h30m|10 minutes> <message>',
      helptext: 'Reminds you of <message> in this channel after the given time',
      handler: async ({ args, nick, target, event, reply }) => {
        const parsed = parseDuration(args)
        if (!parsed?.rest) return reply('Usage: !remind <in 2h|1h30m|10 minutes> <message>')
        if (parsed.ms > MAX_DELAY) return reply("That's too far ahead, I might be late. Try under a year.")

        // counted per ident@host, so changing nick doesn't get around the limit
        const user = userKey(event)
        const mine = (await db.zRange(KEY, 0, -1)).filter(raw => JSON.parse(raw).user === user)
        if (mine.length >= MAX_PER_USER) return reply(`You already have ${MAX_PER_USER} reminders pending`)

        const now = Date.now()
        const reminder = { id: randomUUID(), nick, user, target, text: parsed.rest, created: now }
        await db.zAdd(KEY, { score: now + parsed.ms, value: JSON.stringify(reminder) })
        reply(`Okay ${nick}, I'll remind you in ${formatDuration(parsed.ms)}`)
      }
    }]
  }
}
