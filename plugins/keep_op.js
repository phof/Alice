/*
  When the bot is left alone in a channel: cycle it to regain op if needed,
  otherwise make sure the channel is +sn. The topic is only reset after a cycle.
*/
export default function ({ bot, config }) {
  const joined = new Set()
  // Channels the bot parted and rejoined to regain op
  const cycled = new Set()
  const isMe = (nick) => bot.caseCompare(nick, bot.user.nick)

  // Batch NAMES requests: a netsplit can make hundreds of users quit at once,
  // and one NAMES per quit per channel would get the bot disconnected for flooding
  const pending = new Set()
  let timer = null
  const names = (channel) => {
    pending.add(bot.caseLower(channel))
    timer ??= setTimeout(() => {
      timer = null
      pending.forEach(c => bot.raw('NAMES', c))
      pending.clear()
    }, 3000)
  }

  bot.on('join', (e) => { if (isMe(e.nick)) joined.add(bot.caseLower(e.channel)) })
  bot.on('part', (e) => isMe(e.nick) ? joined.delete(bot.caseLower(e.channel)) : names(e.channel))
  bot.on('kick', (e) => isMe(e.kicked) ? joined.delete(bot.caseLower(e.channel)) : names(e.channel))
  // QUIT doesn't say which channels the user was on, so check them all
  bot.on('quit', (e) => { if (!isMe(e.nick)) joined.forEach(names) })
  bot.on('close', () => {
    joined.clear()
    pending.clear()
    cycled.clear()
  })

  bot.on('userlist', ({ channel, users }) => {
    const wasCycled = cycled.delete(bot.caseLower(channel))
    if (users.length !== 1 || !isMe(users[0].nick)) return

    if (!users[0].modes.includes('o')) {
      console.log(`No op, cycling ${channel}..`)
      cycled.add(bot.caseLower(channel))
      bot.part(channel)
      bot.join(channel)
    } else {
      console.log(`No other users on ${channel}, setting +sn`)
      bot.raw('MODE', channel, '+sn')
      if (wasCycled) bot.raw('TOPIC', channel, config.defaultTopic)
    }
  })

  return { name: 'Keep OP' }
}
