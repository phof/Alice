'use strict'

const irc = require('irc')
const _ = require('lodash')

const bot = new irc.Client(
  process.env.BOT_SERVER || 'localhost',
  process.env.BOT_NICK || 'Alice',
  {
    port: process.env.BOT_PORT || 6667,
    channels: (process.env.BOT_CHANNELS || '#wonderland').split(','),
    userName: process.env.BOT_USERNAME || 'alice',
    realName: process.env.BOT_REALNAME || 'What is a Caucus-race?',
    autoRejoin: true,
    floodProtection: true,
    floodProtectionDelay: 300,
    retryDelay: 5000,
    millisecondsOfSilenceBeforePingSent: 30 * 1000,
    millisecondsBeforePingTimeout: 10 * 1000
  }
)

const rdb = require('./db/redis.js')
const plugins = [
  // Logs
  require('./plugins/logs.js')(bot),

  // Private commands
  require('./plugins/simple_admin.js')(bot),
  require('./plugins/keep_op.js')(bot),
  require('./plugins/auto_op.js')(bot, rdb),

  // Public commands
  require('./plugins/alice.js')(bot),
  require('./plugins/time.js')(bot),
  require('./plugins/weather.js')(bot),
  require('./plugins/memory.js')(bot, rdb)
]

console.log('Plugins loaded', _.size(plugins))

bot.on('registered', message => {
  console.log('Connected')
})

/*
  Help
*/
bot.on('message#', (nick, to, text) => {
  if (text.match(/!help/i)) {
    var helpTopics = _.flatMap(plugins, 'actions')
    for (let topic of helpTopics) {
      if (/!/i.test(topic.command)) bot.say(to, `${topic.command} : ${topic.helptext}`)
    }
  }
})

bot.on('pm', (nick, text) => {
  if (text.match(/@help/i)) {
    var helpTopics = _.flatMap(plugins, 'actions')
    for (let topic of helpTopics) {
      if (/@/i.test(topic.command)) bot.say(nick, `${topic.command} : ${topic.helptext}`)
    }
  }
})

/*
  Listen for other errors
*/
bot.on('error', (err) => {
  console.error('Bot error', err)
})

rdb.on('error', (err) => {
  console.error('Redis error', err)
})

process.on('SIGTERM', () => {
  bot.disconnect('Cycling..', () => {
    process.exit(0)
  })
})
