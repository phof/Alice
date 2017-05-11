'use strict'

module.exports = function (bot, rdb) {
  const re = [
    /@flushdb/i,
    /@disconnect/i
  ]
  bot.on('pm', (nick, text) => {
    if (text.match(re[0])) {
      bot.say(nick, 'Flushing Redis DB')
      rdb.flushdb()
    }

    if (text.match(re[0])) {
      console.log(`${nick} requested bot to disconnect`)
      bot.say(nick, 'Disconnecting')
      bot.disconnect(process.env.DEFAULT_DISCONNECT || "We're all mad here.")
    }
  })

  return {
    name: 'Advanced admin',
    actions: [{
      command: '@flushdb',
      helptext: 'Flushes Redis DB'
    }, {
      command: '@disconnect',
      helptext: 'Disconnects the bot from the network'
    }]
  }
}
