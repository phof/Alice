'use strict'

const async = require('async')

module.exports = (bot, rdb) => {
  const re_remember = /(!remember) (.+?) (.+$)/i
  const re_forget = /(!forget) (.+$)/i
  const re_memory = /!memory/i

  bot.on('message#', (nick, to, text) => {
    /*
      Remember
    */
    let match_remember = text.match(re_remember)
    if (match_remember) {
      let word = match_remember[2].toLowerCase()
      let phrase = match_remember[3]

      rdb.set('memory:' + word, phrase, function (err, reply) {
        if (err) {
          console.error('Error while trying to connect to Redis DB', err)
          bot.say(to, 'Ugh, error while trying to connect to Redis DB')
          return
        }
        bot.say(to, `I will remember "${word}"`)
      })
      return
    }

    /*
      Forget
    */
    let match_forget = text.match(re_forget)
    if (match_forget) {
      let word = match_forget[2].toLowerCase()

      rdb.get('memory:' + word, function (err, reply) {
        if (err) {
          console.error('Error while trying to connect to Redis DB', err)
          bot.say(to, 'Ugh, error while trying to connect to Redis DB')
          return
        }
        if (reply) {
          rdb.del('memory:' + word)
          bot.say(to, `I will forget "${word}"`)
        } else {
          bot.say(to, `${word} is not in my dictionary`)
        }
      })
      return
    }

    /*
      Memory
    */
    let match_memory = text.match(re_memory)
    if (match_memory) {
      rdb.keys('memory:*', function (err, reply) {
        if (err) {
          bot.say(to, 'Ugh, error while trying to connect to Redis DB')
          return
        }
        if (reply.length > 0) {
          bot.say(to, 'I remember the following words: ' + reply.join(', ').replace(/memory:/g, ''))
        } else {
          bot.say(to, "I wasn't instructed to remember anything..")
        }
      })
      return
    }

    /*
      Search Redis everytime someone says something
    */
    let words = text.split(' ')
    let responses = []
    async.each(words, function (word, callback) {
      rdb.get('memory:' + word.toLowerCase(), function (err, reply) {
        if (err) console.error('Error while trying to connect to Redis DB', err)
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
    actions: [{
      command: '!remember <word> <phrase>',
      helptext: 'Any public mentions of <word> will trigger the bot to reply with <phrase>'
    }, {
      command: '!forget <word>',
      helptext: 'Forget the previously recorded <word>'
    }, {
      command: '!memory <message>',
      helptext: 'List of known words'
    }]
  }
}
