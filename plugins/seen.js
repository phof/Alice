import { ago } from '../lib/duration.js'

const YEAR = 365 * 24 * 3600

export default function ({ bot, db }) {
  const key = (nick) => `seen:${bot.caseLower(nick)}`

  const record = (nick, activity) => {
    if (bot.caseCompare(nick, bot.user.nick)) return
    db.set(key(nick), JSON.stringify({ nick, time: Date.now(), ...activity }), { EX: YEAR })
      .catch(err => console.error('Seen update failed', err.message))
  }

  // Only channel activity is recorded, never private messages
  bot.on('privmsg', (e) => {
    if (bot.network.isChannelName(e.target)) record(e.nick, { channel: e.target, text: e.message })
  })
  bot.on('action', (e) => {
    if (bot.network.isChannelName(e.target)) record(e.nick, { channel: e.target, text: `* ${e.nick} ${e.message}` })
  })
  bot.on('join', (e) => record(e.nick, { channel: e.channel, event: 'joining' }))
  bot.on('part', (e) => record(e.nick, { channel: e.channel, event: 'leaving' }))
  bot.on('kick', (e) => record(e.kicked, { channel: e.channel, event: `being kicked by ${e.nick}` }))
  bot.on('quit', (e) => record(e.nick, { event: e.message ? `quitting (${e.message})` : 'quitting' }))
  bot.on('nick', (e) => {
    record(e.nick, { event: `changing nick to ${e.new_nick}` })
    record(e.new_nick, { event: `changing nick from ${e.nick}` })
  })

  const describe = (s) => {
    const where = s.channel ? ` in ${s.channel}` : ''
    return s.text
      ? `${s.nick} was last seen ${ago(s.time)}${where}, saying: ${s.text}`
      : `${s.nick} was last seen ${ago(s.time)} ${s.event}${s.channel ? ` ${s.channel}` : ''}`
  }

  return {
    name: 'Seen',
    commands: [{
      command: '!seen',
      usage: '!seen <nick>',
      helptext: 'Tells when <nick> was last seen, and what they said',
      handler: async ({ argv: [nick], reply, nick: asker }) => {
        if (!nick) return reply('Usage: !seen <nick>')
        if (bot.caseCompare(nick, bot.user.nick)) return reply("I'm right here!")
        if (bot.caseCompare(nick, asker)) return reply('Have you looked in a mirror lately?')
        const seen = await db.get(key(nick))
        reply(seen ? describe(JSON.parse(seen)) : `I haven't seen ${nick}`)
      }
    }]
  }
}
