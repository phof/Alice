'use strict'

module.exports = function (bot) {
  bot.on('pm', function (nick, text) {
    /*
      Join channel
    */
    let match_join = text.match(/(@join) ([#&][^\x07\x2C\s]{0,200})/i)
    if (match_join) {
      let channel = match_join[2]
      console.log(`${nick} requested bot to join ${channel}`)
      bot.say(nick, `Joining ${channel}`)
      bot.join(channel)
      return
    }

    /*
      Part channel
    */
    let match_part = text.match(/(@part) ([#&][^\x07\x2C\s]{0,200})/i)
    if (match_part) {
      let channel = match_part[2]
      console.log(`${nick} requested bot to part ${channel}`)
      bot.say(nick, `Parting ${channel}`)
      bot.part(channel)
      return
    }

    /*
      Op
    */
    let match_op = text.match(/(@op) ([#&][^\x07\x2C\s]{0,200})/i)
    if (match_op) {
      let channel = match_op[2]
      console.log(`${nick} requested OP in ${channel}`)
      bot.say(nick, `OPing you in ${channel}`)
      bot.send('MODE', channel, '+o', nick)
      return
    }

    /*
      Say
    */
    let match_say = text.match(/(@say) (#?[^\x07\x2C\s]{0,200}) (.+$)/i)
    if (match_say) {
      let who = match_say[2]
      let what = match_say[3]
      console.log(`${nick} requested bot to message ${who}: ${what}`)
      bot.say(nick, `Sending message to ${who}: ${what}`)
      bot.say(who, what)
      return
    }

    /*
      Swap nickname
    */
    let match_nick = text.match(/(@nick) (.+$)/i)
    if (match_nick) {
      let newnick = match_nick[2]
      console.log(`${nick} requested bot to change nick to ${newnick}`)
      bot.say(nick, 'Changing nick to ${newnick}')
      bot.send('NICK', newnick)
      return
    }

    /*
      Disconnect
    */
    if (/@disconnect/i.test(text)) {
      console.log(`${nick} requested bot to disconnect`)
      bot.say(nick, 'Disconnecting')
      bot.disconnect(process.env.DEFAULT_DISCONNECT || "We're all mad here.")
      return
    }
  })

  return {
    actions: [{
      command: '@join <channel>',
      helptext: 'Joins <channel>'
    }, {
      command: '@part <channel>',
      helptext: 'Parts <channel>'
    }, {
      command: '@op <channel>',
      helptext: 'OPs you in <channel>'
    }, {
      command: '@say <channel> <phrase>',
      helptext: 'Says <phrase> in <channel>'
    }, {
      command: '@nick <nickname>',
      helptext: 'Updates the bot <nickname>'
    }, {
      command: '@disconnect',
      helptext: 'Disconnects the bot from the network'
    }]
  }
}
//   /*
//     Flush Redis
//   */
//   if (text.match(/!forgetallplz/i)) {
//     bot.say(nick, 'Flushing Redis DB..')
//     rdb.flushdb()
//   }s
