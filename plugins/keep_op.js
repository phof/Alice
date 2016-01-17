'use strict'

const _ = require('lodash')

module.exports = function (bot) {
  bot.on('part', (channel, nick, reason, message) => {
    if (nick !== bot.nick) {
      bot.send('NAMES', channel)
    }
  })

  bot.on('quit', (nick, reason, channels, message) => {
    if (nick !== bot.nick) {
      for (let channel of channels) {
        bot.send('NAMES', channel)
      }
    }
  })

  bot.on('names', (channel, nicks) => {
    let usercount = _.size(nicks)
    console.log(`${usercount} users in ${channel}`)

    if (nicks[bot.nick] !== '@' && usercount === 1) {
      console.log(`Regaining op in ${channel}`)
      bot.part(channel)
      bot.join(channel, () => {
        bot.send('MODE', channel, '+sn')
        bot.send('TOPIC', channel, process.env.DEFAULT_TOPIC || 'Imagination is the only weapon in the war against reality.')
      })
    }
  })

  return {
    actions: []
  }
}
