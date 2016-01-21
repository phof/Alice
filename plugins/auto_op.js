'use strict'

module.exports = function (bot, rdb) {
  bot.on('join', (channel, nick, message) => {
    let nickmask = message.prefix
    rdb.get('user:' + nick, function (err, reply) {
      if (err) console.error('Error while trying to connect to Redis DB', err)
      if (reply) {
        console.log(`${nick} is a known user, checking nickmask`)
        if (nickmask.match(reply)) {
          console.log(`${nick}'s nickmask has been verified, OPing the user`)
          bot.send('MODE', channel, '+o', nick)
        } else {
          console.log(`${nick}'s nickmask couldn't be verified`)
        }
      }
    })
  })

  bot.on('pm', function (nick, text) {
    const redisError = (err) => {
      console.error('Error while trying to connect to Redis DB', err)
      bot.say(nick, 'Ugh, error while trying to connect to Redis DB')
    }

    /*
      Add a user to the auto OP list
      @opadd nickname nickname!~user@localhost
    */
    let match_opadd = text.match(/(@opadd) (.+?) (.+$)/i)
    if (match_opadd) {
      let user = match_opadd[2]
      let nickmask = match_opadd[3]
      rdb.set('user:' + user, nickmask, function (err, reply) {
        if (err) {
          redisError(err)
        } else {
          bot.say(nick, `${user} has been added to the auto-op list`)
        }
      })
      return
    }

    /*
      Remove a user to the auto OP list
    */
    let match_opremove = text.match(/(@opremove) (.+$)/i)
    if (match_opremove) {
      let user = match_opremove[2]
      rdb.get('user:' + user, function (err, reply) {
        if (err) {
          redisError(err)
        } else if (reply) {
          rdb.del('user:' + user, (err, reply) => {
            if (err) {
              redisError(err)
            } else {
              bot.say(nick, `${user} has been removed from the auto-op list`)
            }
          })
        } else {
          bot.say(nick, `${user} is not known`)
        }
      })
      return
    }

    /*
      List users in the auto OP list
    */
    if (text.match(/@oplist/i)) {
      rdb.keys('user:*', function (err, reply) {
        if (err) redisError(err)
        if (reply.length > 0) {
          bot.say(nick, 'Known users: ' + reply.join(', ').replace(/user:/g, ''))
        } else {
          bot.say(nick, `There are no known users`)
        }
      })
    }
  })

  return {
    name: 'Auto-op',
    actions: [{
      command: '@opadd <nick> <hostmask>',
      helptext: "Adds <nick>'s <hostmask> to the auto-op list"
    }, {
      command: '@opremove <nick>',
      helptext: 'Removes <nick> from the auto-op list'
    }, {
      command: '@oplist',
      helptext: 'Lists known users'
    }]
  }
}
