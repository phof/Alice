'use strict'

const async = require('async')

module.exports = (bot, rdb) => {
  const re = [
    /(!remember) (.+?) (.+$)/i,
    /(!forget) (.+$)/i,
    /!memory/i
  ]
  const okay = [
    'Okay,',
    'Cool,',
    'Alright,',
    'Yep,',
    'Sure,',
    'Done,',
    'Roger,',
    'Fine,',
    'Yes,'
  ]

  bot.on('message#', (nick, to, text) => {
    const redisError = (err) => {
      console.error('Error while trying to connect to Redis DB', err)
      bot.say(to, 'Ugh, error while trying to connect to Redis DB')
    }

    /*
      Remember
    */
    let matchRemember = text.match(re[0])
    if (matchRemember) {
      let word = matchRemember[2].toLowerCase()
      let phrase = matchRemember[3]

      rdb.set('memory:' + word, phrase, (err, reply) => {
        if (err) {
          redisError(err)
        } else {
          bot.say(to, okay[Math.floor(Math.random() * okay.length)] + ' will remember ' + word)
        }
      })
      return
    }

    /*
      Forget
    */
    let matchForget = text.match(re[1])
    if (matchForget) {
      let word = matchForget[2].toLowerCase()

      rdb.get('memory:' + word, (err, reply) => {
        if (err) {
          redisError(err)
        } else if (reply) {
          rdb.del('memory:' + word, (err, reply) => {
            if (err) {
              redisError(err)
            } else {
              bot.say(to, okay[Math.floor(Math.random() * okay.length)] + ' will forget ' + word)
            }
          })
        } else {
          bot.say(to, `${word} is not known`)
        }
      })
      return
    }

    /*
      Memory
    */
    let matchMemory = text.match(re[2])
    if (matchMemory) {
      rdb.keys('memory:*', (err, reply) => {
        if (err) {
          redisError(err)
        } else if (reply.length > 0) {
          bot.say(to, 'Known words: ' + reply.join(', ').replace(/memory:/g, ''))
        } else {
          bot.say(to, 'There are no known words')
        }
      })
      return
    }

    /*
      Search Redis everytime someone says something
    */
    let words = text.split(' ')
    let responses = []
    async.each(words, (word, callback) => {
      rdb.get('memory:' + word.toLowerCase(), (err, reply) => {
        if (err) console.error('Error while tryivng to connect to Redis DB', err) // not using redisError here to avoid channel spam
        if (reply) responses.push(reply) // reply is null when the key is missing
        callback()
      })
    }, function (err) {
      if (err) {
        console.error('Error looping through words?!', err)
      } else {
        let randResponse = responses[Math.floor(Math.random() * responses.length)] // if a phrase matches multiple words, take a random one
        bot.say(to, randResponse)
      }
    })
  })

  return {
    name: 'Memory',
    actions: [{
      command: '!remember <word> <phrase>',
      helptext: 'Public mentions of <word> will trigger a reply with <phrase>'
    }, {
      command: '!forget <word>',
      helptext: 'Forgets <word>'
    }, {
      command: '!memory <message>',
      helptext: 'Lists known words'
    }]
  }
}
