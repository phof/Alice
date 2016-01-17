'use strict'

const irc = require('irc')
const _ = require('lodash')

const bot = new irc.Client(process.env.BOT_SERVER || 'localhost', process.env.BOT_NICK || 'Alice', {
  port: process.env.BOT_PORT || 6667,
  channels: (process.env.BOT_CHANNELS || '#wonderland').split(','),
  userName: process.env.BOT_USERNAME || 'Alice',
  realName: process.env.BOT_REALNAME || 'What is a Caucus-race?',
  autoRejoin: true
})

const rdb = require('./db/redis.js')
const plugins = [
  // Logs
  require('./plugins/logs.js')(bot),

  // Private commands
  require('./plugins/simple_admin.js')(bot),
  require('./plugins/keep_op.js')(bot),
  // require('./plugins/auto_op.js')(bot, rdb),

  // Public commands
  require('./plugins/alice.js')(bot),
  require('./plugins/time.js')(bot),
  require('./plugins/weather.js')(bot),
  require('./plugins/pushover.js')(bot),
  require('./plugins/memory.js')(bot, rdb)
]

console.log('Plugins length: ' + _.size(plugins))

/*
  Help
*/
bot.on('message#', (nick, to, text) => {
  if (text.match(/!help/i)) {
    var help_topics = _.flatMap(plugins, 'actions')
    for (let topic of help_topics) {
      if (/!/i.test(topic.command)) bot.say(to, `${topic.command} : ${topic.helptext}`)
    }
  }
})

bot.on('pm', (nick, text) => {
  if (text.match(/@help/i)) {
    var help_topics = _.flatMap(plugins, 'actions')
    for (let topic of help_topics) {
      if (/@/i.test(topic.command)) bot.say(nick, `${topic.command} : ${topic.helptext}`)
    }
  }
})

/*
  Idle functions
*/

/*
  Listen for other errors
*/
bot.on('error', function (err) {
  console.error('Bot error', err)
})

rdb.on('error', function (err) {
  console.error('Redis error', err)
})
