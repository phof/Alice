'use strict'

const _ = require('lodash')

module.exports = (bot, rdb) => {
  const plugins_dir = '../plugins/'
  const plugins = [
    // Logs
    require(plugins_dir + 'logs.js')(bot),

    // Private commands
    require(plugins_dir + 'simple_admin.js')(bot),
    require(plugins_dir + 'advanced_admin.js')(bot, rdb),
    require(plugins_dir + 'keep_op.js')(bot),
    require(plugins_dir + 'auto_op.js')(bot, rdb),

    // Public commands
    require(plugins_dir + 'alice.js')(bot),
    require(plugins_dir + 'time.js')(bot),
    require(plugins_dir + 'weather.js')(bot),
    require(plugins_dir + 'pushover.js')(bot),
    require(plugins_dir + 'memory.js')(bot, rdb)
  ]

  const names = _.map(plugins, 'name')
  const count = _.size(plugins)
  const actions = _.flatMap(plugins, 'actions')
  const pub_actions = _.filter(actions, (n) => {
    return /^!/i.test(n.command)
  })
  const pri_actions = _.filter(actions, (n) => {
    return /^@/i.test(n.command)
  })

  bot.on('message#', (nick, to, text) => {
    if (/!help/i.test(text)) {
      for (let action of pub_actions) {
        bot.say(to, `${action.command} — ${action.helptext}`)
      }
    }
  })

  bot.on('pm', (nick, text) => {
    if (/@help/i.test(text)) {
      for (let action of pri_actions) {
        bot.say(nick, `${action.command} — ${action.helptext}`)
      }
    }
  })

  return {
    count: count,
    list: names.join(', '),
    public_actions: pub_actions,
    private_actions: pri_actions
  }
}
