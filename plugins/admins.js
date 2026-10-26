import { isValidMask } from '../lib/mask.js'

export default function ({ bot, admins }) {
  // Accepts a full hostmask, or a nick to look up with WHOIS
  const resolveMask = (arg) => new Promise((resolve) => {
    if (isValidMask(arg)) return resolve(arg)
    if (/[!@*?\s]/.test(arg)) return resolve(null)

    // Own listener rather than bot.whois(), so it can be removed on timeout
    const done = (mask) => {
      clearTimeout(timer)
      bot.removeListener('whois', onWhois)
      resolve(mask)
    }
    const onWhois = (e) => {
      if (!bot.caseCompare(e.nick, arg)) return
      done(e.error || !e.hostname ? null : `*!${e.ident}@${e.hostname}`)
    }
    const timer = setTimeout(() => done(null), 5000)
    bot.on('whois', onWhois)
    bot.raw('WHOIS', arg)
  })

  return {
    name: 'Admins',
    commands: [{
      command: '@claim',
      usage: '@claim <code>',
      helptext: 'Makes you the bot owner, using the one-time code from the bot logs',
      access: 'anyone',
      handler: async ({ argv: [code], event, reply }) => {
        const mask = await admins.claim(code, event)
        if (!mask) return reply('That code is not valid.')
        console.log(`OWNER | ${event.nick} claimed the bot as ${mask}`)
        reply(`You're the owner now, matched as ${mask}. Use @owner <mask> to change it, e.g. if your IP changes often.`)
      }
    }, {
      command: '@owner',
      usage: '@owner [mask]',
      helptext: 'Shows the owner mask; the owner can change it, i.e.: @owner *!~me@*.myisp.net',
      handler: async ({ argv: [mask], event, reply }) => {
        if (!mask) return reply(`Owner: ${await admins.owner() ?? 'nobody'}`)
        if (!await admins.isOwner(event)) return reply('Only the owner can change the owner mask.')
        if (!isValidMask(mask)) return reply('Usage: @owner <nick!user@host> (* and ? wildcards allowed)')
        await admins.setOwner(mask)
        console.log(`OWNER | ${event.nick} changed the owner mask to ${mask}`)
        reply(`Owner mask is now ${mask}. Make sure it still matches you!`)
      }
    }, {
      command: '@adminadd',
      usage: '@adminadd <nick|mask>',
      helptext: 'Adds an admin, by hostmask or by the current host of an online <nick>',
      handler: async ({ argv: [arg], nick, reply }) => {
        if (!arg) return reply('Usage: @adminadd <nick|nick!user@host>')
        const mask = await resolveMask(arg)
        if (!mask) return reply(`Couldn't find ${arg}. Is it online, or a valid nick!user@host mask?`)
        const added = await admins.add(mask)
        if (added) console.log(`ADMIN | ${nick} added ${mask}`)
        reply(added ? `Added ${mask} as admin` : `${mask} is already an admin`)
      }
    }, {
      command: '@admindel',
      usage: '@admindel <mask>',
      helptext: 'Removes an admin (see @adminlist); the owner cannot be removed',
      handler: async ({ argv: [mask], nick, reply }) => {
        if (!mask) return reply('Usage: @admindel <mask>')
        if (mask === await admins.owner()) return reply("The owner can't be removed.")
        const removed = await admins.remove(mask)
        if (removed) console.log(`ADMIN | ${nick} removed ${mask}`)
        reply(removed ? `Removed ${mask}` : `${mask} is not an admin`)
      }
    }, {
      command: '@adminlist',
      helptext: 'Lists the owner and admins',
      handler: async ({ reply }) => {
        const [owner, list] = [await admins.owner(), await admins.admins()]
        reply(`Owner: ${owner ?? 'nobody'}`)
        reply(list.length ? `Admins: ${list.join(', ')}` : 'No other admins')
      }
    }]
  }
}
