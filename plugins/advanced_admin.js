'use strict'

module.exports = function (bot, rdb) {
  bot.on('pm', (nick, text) => {
    if (/@flushdb/i.test(text)) {
      bot.say(nick, 'Flushing Redis DB')
      rdb.flushdb()
    }

    if (/@disconnect/i.test(text)) {
      console.log(`${nick} requested bot to disconnect`)
      bot.say(nick, 'Disconnecting')
      bot.disconnect(process.env.DEFAULT_DISCONNECT || "We're all mad here.")
      return
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
