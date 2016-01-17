'use strict'

const Pushover = require('pushover-notifications')

module.exports = (bot) => {
  const re_push = /(!push) (.+$)/i
  const p = new Pushover({
    user: process.env.PUSHOVER_USER || 'YQBJZv66Hwv9qm3WgQdHgE86bRdU0R',
    token: process.env.PUSHOVER_TOKEN || 'Xz5XrdeVrmJ5prs0MRrGFJrP7OInM2'
  })

  bot.on('message#', (nick, to, text) => {
    let match_push = text.match(re_push)

    if (match_push) {
      let body = match_push[2]
      p.send({
        message: body,
        title: `New IRC message from ${nick}`,
        sound: 'magic'
      }, function (err, result) {
        let results = JSON.parse(result)
        if (err || results.errors) {
          console.error('Error while sending pushover message', err || results.errors)
          bot.say(to, 'Ugh, error while sending pushover message')
        } else {
          bot.say(to, 'Message sent!')
        }
      })
      return
    }
  })

  return {
    actions: [{
      command: '!push <message>',
      helptext: 'Sends a Pushover.net message to the bot owner'
    }]
  }
}
