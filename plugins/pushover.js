'use strict'

const Pushover = require('pushover-notifications')

module.exports = (bot) => {
  const re = /(!push) (.+$)/i
  const p = new Pushover({
    user: process.env.PUSHOVER_USER || '',
    token: process.env.PUSHOVER_TOKEN || ''
  })

  bot.on('message#', (nick, to, text) => {
    let matchPush = text.match(re)
    if (matchPush) {
      let body = matchPush[2]
      p.send({
        message: body,
        title: `New IRC message from ${nick}`,
        sound: 'magic'
      }, function (err, result) {
        let results = JSON.parse(result)
        if (err || results.errors) {
          console.error('Error while sending Pushover message', err || results.errors)
          bot.say(to, 'Ugh, error while sending Pushover message')
        } else {
          bot.say(to, 'Message sent!')
        }
      })
    }
  })

  return {
    name: 'Pushover',
    actions: [{
      command: '!push <message>',
      helptext: 'Sends a Pushover.net message to the bot owner'
    }]
  }
}
