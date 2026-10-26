import { readFileSync } from 'node:fs'
import { Client } from 'irc-framework'
import config from './lib/config.js'
import { createRouter } from './lib/commands.js'
import { throttle } from './lib/throttle.js'
import { connectRedis } from './db/redis.js'

import logs from './plugins/logs.js'
import simpleAdmin from './plugins/simple_admin.js'
import keepOp from './plugins/keep_op.js'
import autoOp from './plugins/auto_op.js'
import alice from './plugins/alice.js'
import time from './plugins/time.js'
import weather from './plugins/weather.js'
import memory from './plugins/memory.js'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

const bot = new Client()
const db = connectRedis(config.redisUrl)
throttle(bot)

const plugins = [
  // Logs
  logs,

  // Private commands
  simpleAdmin,
  keepOp,
  autoOp,

  // Public commands
  alice,
  time,
  weather,
  memory
].map(plugin => plugin({ bot, db, config }))

createRouter(bot, config, plugins)
console.log('Plugins loaded', plugins.map(p => p.name).join(', '))

if (config.admins.length === 0 && config.adminAccounts.length === 0) {
  console.warn('No BOT_ADMINS or BOT_ADMIN_ACCOUNTS set: @admin commands are disabled')
}

bot.on('registered', () => {
  console.log(`Connected to ${config.irc.host} as ${bot.user.nick}`)
  config.channels.forEach(channel => bot.join(channel))
})

bot.on('reconnecting', (e) => console.log(`Reconnecting (attempt ${e.attempt}/${e.max_retries})..`))
bot.on('sasl failed', (e) => console.error('SASL authentication failed', e.reason))
bot.on('irc error', (e) => console.error('IRC error', e.error, e.reason ?? ''))

// irc-framework gave up reconnecting: exit and let the process manager restart us
bot.on('close', () => {
  console.error('Connection closed')
  shutdown(1)
})

bot.connect({
  ...config.irc,
  version: `Alice ${version}`,
  auto_reconnect: true,
  auto_reconnect_max_retries: 30
})

let stopping = false
async function shutdown (code = 0) {
  if (stopping) return
  stopping = true
  if (bot.connected) {
    bot.quit('Cycling..')
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  await db.close().catch(() => {})
  process.exit(code)
}

process.on('SIGTERM', () => shutdown())
process.on('SIGINT', () => shutdown())
