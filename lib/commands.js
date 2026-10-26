import { hostmaskOf } from './mask.js'
import { createLimiter, userKey } from './ratelimit.js'

/*
  Routes "!command" channel messages and "@command" private messages to plugins.

  A plugin command looks like:
    { command: '!alice', usage: '!alice', helptext: '...', handler: async (ctx) => {} }

  ctx = { nick, target, args, argv, event, reply }
  "@" commands are private and only run for admins, unless they set access: 'anyone'.
  Every user is rate limited, except admins using "@" commands.
*/
export function createRouter (bot, admins, plugins, { rateLimit = { burst: 5, interval: 6 } } = {}) {
  const limiter = createLimiter(rateLimit)
  setInterval(() => limiter.prune(), 60_000).unref()

  const commands = new Map()
  for (const plugin of plugins) {
    for (const cmd of plugin.commands ?? []) commands.set(cmd.command.toLowerCase(), cmd)
  }

  // One line with all command names, or the details of one command
  const help = (prefix, name) => {
    if (name) {
      const cmd = commands.get((name.startsWith(prefix) ? name : prefix + name).toLowerCase())
      return cmd?.command.startsWith(prefix)
        ? `${cmd.usage ?? cmd.command} : ${cmd.helptext}`
        : `There's no ${prefix}${name.replace(/^[!@]/, '')} command. Try ${prefix}help`
    }
    const names = [...commands.values()].map(cmd => cmd.command).filter(c => c.startsWith(prefix))
    const title = prefix === '@' ? 'Admin commands' : 'Commands'
    return `${title}: ${names.join(' ')} · ${prefix}help <command> for details`
  }

  commands.set('!help', {
    command: '!help',
    usage: '!help [command]',
    helptext: 'Lists the commands, or explains one, i.e.: !help remind',
    handler: ({ nick, argv: [name] }) => bot.notice(nick, help('!', name))
  })
  commands.set('@help', {
    command: '@help',
    usage: '@help [command]',
    helptext: 'Lists the admin commands, or explains one, i.e.: @help opadd',
    handler: ({ nick, argv: [name] }) => bot.notice(nick, help('@', name))
  })

  bot.on('privmsg', async (event) => {
    const isPrivate = !bot.network.isChannelName(event.target)
    const text = event.message.trim()
    const prefix = isPrivate ? '@' : '!'
    if (!text.startsWith(prefix)) return

    const [name, ...argv] = text.split(/\s+/)
    const cmd = commands.get(name.toLowerCase())
    if (!cmd) return

    const admin = isPrivate && await admins.isAdmin(event)
    if (!admin) {
      const limit = limiter.take(userKey(event))
      if (!limit.ok) {
        if (limit.warn) {
          console.warn(`LIMITED | ${hostmaskOf(event)} is sending too many commands`)
          bot.notice(event.nick, `Slow down! The White Rabbit is late enough. Try again in ${limit.wait}s.`)
        }
        return
      }
    }

    if (isPrivate && cmd.access !== 'anyone' && !admin) {
      console.warn(`DENIED | ${hostmaskOf(event)} tried ${name}`)
      bot.say(event.nick, "Sorry, you're not on the guest list.")
      return
    }

    const reply = (message) => bot.say(isPrivate ? event.nick : event.target, message)
    try {
      await cmd.handler({
        nick: event.nick,
        target: event.target,
        args: text.slice(name.length).trim(),
        argv,
        event,
        reply
      })
    } catch (err) {
      console.error(`Error while running ${name}`, err)
      reply(`Ugh, something went wrong with ${name}`)
    }
  })

  return { commands, help, limiter }
}

export const pick = (list) => list[Math.floor(Math.random() * list.length)]
