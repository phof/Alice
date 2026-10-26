export default function ({ bot }) {
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
    }]
  }
}
