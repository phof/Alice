'use strict'

module.exports = function (bot) {
  bot.on('pm', (nick, text) => {
    console.log(`PM | Private message from ${nick}`)
  })

  bot.on('message#', (nick, to, text) => {
    let channel = to
    console.log(`MESSAGE | Message on ${channel} from ${nick}`)
  })

  bot.on('join', (channel, nick, message) => {
    console.log(`JOIN | ${nick} joined ${channel}`)
  })

  bot.on('part', (channel, nick, reason, message) => {
    console.log(`PART | ${nick} left ${channel}`)
  })

  bot.on('quit', (nick, reason, channels, message) => {
    console.log(`QUIT | ${nick} left ${channels}`)
  })

  bot.on('names', (channel, nicks) => {
    nicks = JSON.stringify(nicks)
    console.log(`NAMES | ${channel} members: ${nicks}`)
  })

  bot.on('ctcp-version', (from, to, message) => {
    console.log(`VERSION | CTCP VERSION from ${message.prefix}`)
  })

  return {
    name: 'Simple log',
    actions: []
  }
}
