import { ago } from '../lib/duration.js'

const MAX_PENDING = 10
const MONTHS = 90 * 24 * 3600

export default function ({ bot, db }) {
  const key = (nick) => `tell:${bot.caseLower(nick)}`

  // Deliver waiting messages the next time someone speaks in a channel
  bot.on('privmsg', async (e) => {
    if (!bot.network.isChannelName(e.target)) return
    try {
      const k = key(e.nick)
      const [messages] = await db.multi().lRange(k, 0, -1).del(k).exec()
      for (const raw of messages) {
        const m = JSON.parse(raw)
        bot.say(e.target, `${e.nick}: ${m.from} said ${ago(m.time)}: ${m.text}`)
      }
    } catch (err) {
      console.error('Tell delivery failed', err.message)
    }
  })

  return {
    name: 'Tell',
    commands: [{
      command: '!tell',
      usage: '!tell <nick> <message>',
      helptext: 'Gives <message> to <nick> the next time they speak',
      handler: async ({ argv: [to], args, nick, reply }) => {
        const text = args.slice(to?.length ?? 0).trim()
        if (!to || !text) return reply('Usage: !tell <nick> <message>')
        if (bot.caseCompare(to, bot.user.nick)) return reply("I'm listening already!")
        if (bot.caseCompare(to, nick)) return reply('Talking to yourself? Curiouser and curiouser.')

        const k = key(to)
        if (await db.lLen(k) >= MAX_PENDING) return reply(`${to} already has ${MAX_PENDING} messages waiting`)
        await db.multi()
          .rPush(k, JSON.stringify({ from: nick, text, time: Date.now() }))
          .expire(k, MONTHS)
          .exec()
        reply(`Okay, I'll tell ${to} next time they speak`)
      }
    }]
  }
}
