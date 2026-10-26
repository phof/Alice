export default function ({ bot, db, config, admins, shutdown }) {
  const channelArg = (handler, usage) => (ctx) => {
    const channel = ctx.argv[0]
    if (!channel || !bot.network.isChannelName(channel)) return ctx.reply(`Usage: ${usage}`)
    return handler(ctx, channel)
  }

  return {
    name: 'Simple admin',
    commands: [{
      command: '@join',
      usage: '@join <channel>',
      helptext: 'Joins <channel>',
      handler: channelArg(({ nick, reply }, channel) => {
        console.log(`${nick} requested bot to join ${channel}`)
        reply(`Joining ${channel}`)
        bot.join(channel)
      }, '@join <channel>')
    }, {
      command: '@part',
      usage: '@part <channel>',
      helptext: 'Parts <channel>',
      handler: channelArg(({ nick, reply }, channel) => {
        console.log(`${nick} requested bot to part ${channel}`)
        reply(`Parting ${channel}`)
        bot.part(channel)
      }, '@part <channel>')
    }, {
      command: '@op',
      usage: '@op <channel>',
      helptext: 'OPs you in <channel>',
      handler: channelArg(({ nick, reply }, channel) => {
        console.log(`${nick} requested OP in ${channel}`)
        reply(`OPing you in ${channel}`)
        bot.raw('MODE', channel, '+o', nick)
      }, '@op <channel>')
    }, {
      command: '@say',
      usage: '@say <target> <phrase>',
      helptext: 'Says <phrase> to <target> (a channel or a nick)',
      handler: ({ nick, argv, args, reply }) => {
        const who = argv[0]
        const what = args.slice(who?.length ?? 0).trim()
        if (!who || !what) return reply('Usage: @say <target> <phrase>')
        console.log(`${nick} requested bot to message ${who}: ${what}`)
        reply(`Sending message to ${who}: ${what}`)
        bot.say(who, what)
      }
    }, {
      command: '@nick',
      usage: '@nick <nickname>',
      helptext: 'Changes the bot <nickname>',
      handler: ({ nick, argv: [newNick], reply }) => {
        if (!newNick) return reply('Usage: @nick <nickname>')
        console.log(`${nick} requested bot to change nick to ${newNick}`)
        reply(`Changing nick to ${newNick}`)
        bot.changeNick(newNick)
      }
    }, {
      command: '@flushdb',
      usage: '@flushdb confirm',
      helptext: 'Owner only: deletes ALL bot data (admins, auto-ops, memories, reminders, seen...), keeping only the owner',
      handler: async ({ nick, argv: [confirm], event, reply }) => {
        if (!await admins.isOwner(event)) return reply('Only the owner can flush the database.')
        if (confirm !== 'confirm') {
          return reply('This deletes ALL bot data: admins, auto-ops, memories, reminders, tells, seen and greetings. The owner is kept. Send "@flushdb confirm" to go ahead.')
        }
        console.log(`${nick} flushed the Redis database`)
        // keep the owner, or nobody could manage the bot until it's restarted
        const owner = await admins.owner()
        await db.flushDb()
        if (owner) await admins.setOwner(owner)
        reply('Flushed the database. You are still the owner.')
      }
    }, {
      command: '@disconnect',
      helptext: 'Disconnects the bot and stops it; under systemd, start it again with: systemctl start alice',
      handler: ({ nick }) => {
        console.log(`${nick} requested bot to disconnect`)
        bot.sayNow(nick, 'Disconnecting. Start me again with: systemctl start alice')
        return shutdown(0, config.quitMessage)
      }
    }]
  }
}
