import { matchMask, hostmaskOf } from './mask.js'

/*
  Routes "!command" channel messages and "@command" private messages to plugins.

  A plugin command looks like:
    { command: '!alice', usage: '!alice', helptext: '...', handler: async (ctx) => {} }

  ctx = { nick, target, args, argv, event, reply }
  "@" commands are private and only run for admins.
*/
export function isAdmin (event, config) {
  if (event.account && config.adminAccounts.includes(event.account.toLowerCase())) return true
  return config.admins.some(mask => matchMask(mask, hostmaskOf(event)))
}

export function createRouter (bot, config, plugins) {
  const commands = new Map()
  for (const plugin of plugins) {
    for (const cmd of plugin.commands ?? []) commands.set(cmd.command.toLowerCase(), cmd)
  }

  const help = (prefix) => [...commands.values()]
    .filter(cmd => cmd.command.startsWith(prefix))
    .map(cmd => `${cmd.usage ?? cmd.command} : ${cmd.helptext}`)

  commands.set('!help', {
    command: '!help',
    helptext: 'Lists public commands',
    handler: ({ nick }) => help('!').forEach(line => bot.notice(nick, line))
  })
  commands.set('@help', {
    command: '@help',
    helptext: 'Lists admin commands',
    handler: ({ nick }) => help('@').forEach(line => bot.notice(nick, line))
  })

  bot.on('privmsg', async (event) => {
    const isPrivate = !bot.network.isChannelName(event.target)
    const text = event.message.trim()
    const prefix = isPrivate ? '@' : '!'
    if (!text.startsWith(prefix)) return

    const [name, ...argv] = text.split(/\s+/)
    const cmd = commands.get(name.toLowerCase())
    if (!cmd) return

    if (isPrivate && !isAdmin(event, config)) {
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

  return { commands, help }
}

export const pick = (list) => list[Math.floor(Math.random() * list.length)]
