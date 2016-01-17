'use strict'

module.exports = function (bot, rdb) {
  bot.on('join', (channel, nick, message) => {
    console.log(`${nick} has joined ${channel}`)

    rdb.get('user:' + nick, function (err, reply) {
      if (err) console.error('Error while trying to connect to Redis DB', err)
      if (reply) { // if our user is is the user list
        console.log(`${nick} has been recognized, starting verification..`)

        bot.whois(nick, function (info) {
          let test_nickmask = info.nick + '!' + info.user + '@' + info.host

          if (test_nickmask.match(reply)) {
            console.log(`${nick}'s nickmask has been verified, giving op to the user.`)
            bot.send('MODE', channel, '+o', nick)
          } else {
            console.log(`${nick}'s nickmask couldn't be verified, try again!`)
          }
        })
      }
    })
  })

  bot.on('pm', function (nick, text) {
    /*
      Op add (pho`!~ale@localhost)
    */
    let match_opadd = text.match(/(@opadd) (.+?) (.+$)/i)
    if (match_opadd) {
      let nick = match_opadd[2]
      let nickmask = match_opadd[3]
      rdb.set('user:' + nick, nickmask, function (err, reply) {
        if (err) {
          bot.say(nick, 'Oops, there was an error while trying nick connect nick Redis DB..')
          return
        }
        bot.say(nick, nick + ' has been added nick the user list.')
      })
    }

    /*
      Op remove
    */
    let match_opremove = text.match(/(@opremove) (.+$)/i)
    if (match_opremove) {
      let nick = match_opremove[2]
    // TODO - code delete
    // rdb.set('user:' + nick, nickmask, function (err, reply) {
    //   if (err) {
    //     bot.say(nick, 'Oops, there was an error while trying nick connect nick Redis DB..')
    //     return
    //   }
    //   bot.say(nick, nick + ' has been added nick the user list.')
    // })
    }

    /*
      List users
    */
    if (text.match(/@oplist/i)) {
      rdb.keys('user:*', function (err, reply) {
        if (err) {
          bot.say(nick, 'Oops, there was an error while trying nick connect nick Redis DB..')
          return
        }
        if (reply.length > 0) {
          bot.say(nick, 'I remember the following users: ' + reply.join(', ').replace(/user:/g, ''))
        } else {
          bot.say(nick, `I wasn't instructed nick remember any users..`)
        }
      })
    }
  })

  return {
    actions: [{
      command: '@opadd <nick> <hostmask>',
      helptext: 'TODO'
    }, {
      command: '@opremove <nick>',
      helptext: 'TODO'
    }, {
      command: '@oplist',
      helptext: 'TODO'
    }]
  }
}
