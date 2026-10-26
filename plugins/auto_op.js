import { matchMask, isValidMask, hostmaskOf } from '../lib/mask.js'
import { scanKeys } from '../db/redis.js'

export default function ({ bot, db }) {
  const key = (nick) => `user:${nick.toLowerCase()}`

  bot.on('join', async (e) => {
    if (bot.caseCompare(e.nick, bot.user.nick)) return
    try {
      const mask = await db.get(key(e.nick))
      if (!mask) return
      if (matchMask(mask, hostmaskOf(e))) {
        console.log(`${e.nick}'s hostmask has been verified, OPing the user`)
        bot.raw('MODE', e.channel, '+o', e.nick)
      } else {
        console.log(`${e.nick} is a known user but ${hostmaskOf(e)} doesn't match ${mask}`)
      }
    } catch (err) {
      console.error('Auto-op lookup failed', err.message)
    }
  })

  return {
    name: 'Auto-op',
    commands: [{
      command: '@opadd',
      usage: '@opadd <nick> <hostmask>',
      helptext: "Adds <nick>'s <hostmask> to the auto-op list, i.e.: @opadd nick nick!~user@*.example.com",
      handler: async ({ argv: [nick, mask], reply }) => {
        if (!nick || !mask || !isValidMask(mask)) return reply('Usage: @opadd <nick> <nick!user@host> (* and ? wildcards allowed)')
        await db.set(key(nick), mask)
        reply(`${nick} has been added to the auto-op list`)
      }
    }, {
      command: '@opremove',
      usage: '@opremove <nick>',
      helptext: 'Removes <nick> from the auto-op list',
      handler: async ({ argv: [nick], reply }) => {
        if (!nick) return reply('Usage: @opremove <nick>')
        const removed = await db.del(key(nick))
        reply(removed ? `${nick} has been removed from the auto-op list` : `${nick} is not known`)
      }
    }, {
      command: '@oplist',
      helptext: 'Lists known users',
      handler: async ({ reply }) => {
        const nicks = (await scanKeys(db, 'user:*')).map(k => k.slice('user:'.length))
        reply(nicks.length ? `Known users: ${nicks.join(', ')}` : 'There are no known users')
      }
    }]
  }
}
