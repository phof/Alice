import { matchMask, isValidMask, hostmaskOf } from '../lib/mask.js'
import { scanKeys } from '../db/redis.js'

export default function ({ bot, db, config, admins }) {
  // IRC nicks are case-insensitive, with IRC's own rules: [ ] \ are the uppercase of { } |
  const key = (nick) => `user:${bot.caseLower(nick)}`

  // Entries used to be stored with the nick as typed; move them to the lowercase key
  async function migrate () {
    for (const k of await scanKeys(db, 'user:*')) {
      const lower = key(k.slice('user:'.length))
      if (lower === k) continue
      if (await db.exists(lower)) await db.del(k)
      else await db.rename(k, lower)
      console.log(`Auto-op: migrated ${k} to ${lower}`)
    }
  }
  db.on('ready', () => migrate().catch(err => console.error('Auto-op migration failed', err.message)))

  // The owner and admins are always opped; others only if they're on the auto-op list
  bot.on('join', async (e) => {
    if (bot.caseCompare(e.nick, bot.user.nick)) return
    try {
      if (await admins.isAdmin(e)) {
        console.log(`${e.nick} is an admin, OPing the user`)
        bot.raw('MODE', e.channel, '+o', e.nick)
        return
      }
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
    migrate,
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
        reply(removed ? `${nick} has been removed from the auto-op list` : `${nick} isn't on the auto-op list`)
      }
    }, {
      command: '@oplist',
      helptext: 'Lists everyone opped on join: the owner, admins and the auto-op list',
      handler: async ({ reply }) => {
        const owner = await admins.owner()
        const adminMasks = [...config.admins, ...await admins.admins()]
        const keys = await scanKeys(db, 'user:*')
        const masks = keys.length ? await db.mGet(keys) : []
        const autoOp = keys.map((k, i) => `${k.slice('user:'.length)} (${masks[i]})`)

        const parts = [
          owner && `owner ${owner}`,
          adminMasks.length && `admins ${adminMasks.join(', ')}`,
          autoOp.length && `auto-op ${autoOp.join(', ')}`
        ].filter(Boolean)
        reply(parts.length ? `Opped on join: ${parts.join(' · ')}` : 'Nobody is opped on join yet')
      }
    }]
  }
}
