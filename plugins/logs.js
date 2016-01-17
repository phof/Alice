'use strict'

module.exports = function (bot) {
  bot.on('pm', (nick, text) => {
    console.log(`PM | Private message from ${nick}: ${text}`)
  })

  bot.on('message#', (nick, to, text) => {
    console.log(`MESSAGE | Public message to ${to} from ${nick}: ${text}`)
  })

  bot.on('join', (channel, nick, message) => {
    console.log(`JOIN | ${nick} has joined ${channel}`)
  })

  bot.on('part', (channel, nick, reason, message) => {
    console.log(`PART | ${nick} has left ${channel}`)
  })

  bot.on('quit', (nick, reason, channels, message) => {
    console.log(`QUIT | ${nick} has left ${channels}`)
  })

  bot.on('names', (channel, nicks) => {
    nicks = JSON.stringify(nicks)
    console.log(`NAMES | ${channel} members: ${nicks}`)
  })

  return {
    actions: []
  }
}
