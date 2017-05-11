'use strict'

module.exports = function (bot) {
  bot.on('pm', function (nick, text) {
    const re = [
      /(@join) ([#&][^\x07\x2C\s]{0,200})/i,
      /(@part) ([#&][^\x07\x2C\s]{0,200})/i,
      /(@op) ([#&][^\x07\x2C\s]{0,200})/i,
      /(@say) (#?[^\x07\x2C\s]{0,200}) (.+$)/i,
      /(@nick) (.+$)/i
    ]

    /*
      Join channel
    */
    let matchJoin = text.match(re[0])
    if (matchJoin) {
      let channel = matchJoin[2]
      console.log(`${nick} requested bot to join ${channel}`)
      bot.say(nick, `Joining ${channel}`)
      bot.join(channel)
      return
    }

    /*
      Part channel
    */
    let matchPart = text.match(re[1])
    if (matchPart) {
      let channel = matchPart[2]
      console.log(`${nick} requested bot to part ${channel}`)
      bot.say(nick, `Parting ${channel}`)
      bot.part(channel)
      return
    }

    /*
      Op
    */
    let matchOp = text.match(re[2])
    if (matchOp) {
      let channel = matchOp[2]
      console.log(`${nick} requested OP in ${channel}`)
      bot.say(nick, `OPing you in ${channel}`)
      bot.send('MODE', channel, '+o', nick)
      return
    }

    /*
      Say
    */
    let matchSay = text.match(re[3])
    if (matchSay) {
      let who = matchSay[2]
      let what = matchSay[3]
      console.log(`${nick} requested bot to message ${who}: ${what}`)
      bot.say(nick, `Sending message to ${who}: ${what}`)
      bot.say(who, what)
      return
    }

    /*
      Swap nickname
    */
    let matchNick = text.match(re[4])
    if (matchNick) {
      let newnick = matchNick[2]
      console.log(`${nick} requested bot to change nick to ${newnick}`)
      bot.say(nick, `Changing nick to ${newnick}`)
      bot.send('NICK', newnick)
    }
  })

  return {
    name: 'Simple admin',
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
    }]
  }
}
