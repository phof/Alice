'use strict'

const irc = require('irc')

/*
  Bot
*/
const bot = new irc.Client(process.env.BOT_SERVER || 'localhost', process.env.BOT_NICK || 'Alice', {
  port: process.env.BOT_PORT || 6667,
  channels: (process.env.BOT_CHANNELS || '#wonderland').split(','),
  userName: process.env.BOT_USERNAME || 'Alice',
  realName: process.env.BOT_REALNAME || 'What is a Caucus-race?',
  autoRejoin: true,
  floodProtection: true,
  floodProtectionDelay: 500
})

/*
  Libs
*/
const rdb = require('./libs/redis.js')
const plugins = require('./libs/plugins.js')(bot, rdb)
console.log(`Plugins(${plugins.count}): ${plugins.list}`)

/*
  Catch exceptions
*/
bot.on('error', function (err) {
  console.error('Bot error', err)
})
