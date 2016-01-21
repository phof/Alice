'use strict'

const async = require('async')

module.exports = (bot, rdb) => {
  const re_remember = /(!remember) (.+?) (.+$)/i
  const re_forget = /(!forget) (.+$)/i
  const re_memory = /!memory/i

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
    let match_remember = text.match(re_remember)
    if (match_remember) {
      let word = match_remember[2].toLowerCase()
      let phrase = match_remember[3]

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
    let match_forget = text.match(re_forget)
    if (match_forget) {
      let word = match_forget[2].toLowerCase()

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
    let match_memory = text.match(re_memory)
    if (match_memory) {
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
        if (err) console.error('Error while trying to connect to Redis DB', err) // not using redisError here to avoid channel spam
        if (reply) responses.push(reply) // reply is null when the key is missing
        callback()
      })
    }, function (err) {
      if (err) {
        console.error('Error looping through words?!', err)
      } else {
        let rand_response = responses[Math.floor(Math.random() * responses.length)] // if a phrase matches multiple words, take a random one
        bot.say(to, rand_response)
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
