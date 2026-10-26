/*
  When the bot is left alone in a channel: cycle it to regain op if needed,
  otherwise reset the channel modes and topic.
*/
export default function ({ bot, config }) {
  const joined = new Set()
  const isMe = (nick) => bot.caseCompare(nick, bot.user.nick)
  const names = (channel) => bot.raw('NAMES', channel)

  bot.on('join', (e) => { if (isMe(e.nick)) joined.add(bot.caseLower(e.channel)) })
  bot.on('part', (e) => isMe(e.nick) ? joined.delete(bot.caseLower(e.channel)) : names(e.channel))
  bot.on('kick', (e) => isMe(e.kicked) ? joined.delete(bot.caseLower(e.channel)) : names(e.channel))
  // QUIT doesn't say which channels the user was on, so check them all
  bot.on('quit', (e) => { if (!isMe(e.nick)) joined.forEach(names) })
  bot.on('close', () => joined.clear())

  bot.on('userlist', ({ channel, users }) => {
    if (users.length !== 1 || !isMe(users[0].nick)) return

    if (!users[0].modes.includes('o')) {
      console.log(`No op, cycling ${channel}..`)
      bot.part(channel)
      bot.join(channel)
    } else {
      console.log(`No other users on ${channel}, resetting topic/mode`)
      bot.raw('MODE', channel, '+sn')
      bot.raw('TOPIC', channel, config.defaultTopic)
    }
  })

  return { name: 'Keep OP' }
}
