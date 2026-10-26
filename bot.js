import { readFileSync } from 'node:fs'
import { Client } from 'irc-framework'
import config from './lib/config.js'
import { createRouter } from './lib/commands.js'
import { createAdmins } from './lib/admins.js'
import { throttle } from './lib/throttle.js'
import { connectRedis } from './db/redis.js'

import logs from './plugins/logs.js'
import adminCommands from './plugins/admins.js'
import simpleAdmin from './plugins/simple_admin.js'
import keepOp from './plugins/keep_op.js'
import autoOp from './plugins/auto_op.js'
import alice from './plugins/alice.js'
import time from './plugins/time.js'
import weather from './plugins/weather.js'
import memory from './plugins/memory.js'
import seen from './plugins/seen.js'
import tell from './plugins/tell.js'
import remind from './plugins/remind.js'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

const bot = new Client()
const db = connectRedis(config.redisUrl)
const admins = createAdmins(db, config)
throttle(bot)

const plugins = [
  // Logs
  logs,

  // Private commands
  adminCommands,
  simpleAdmin,
  keepOp,
  autoOp,

  // Public commands
  alice,
  time,
  weather,
  memory,
  seen,
  tell,
  remind
].map(plugin => plugin({ bot, db, config, admins }))

createRouter(bot, admins, plugins)
console.log('Plugins loaded', plugins.map(p => p.name).join(', '))

// Once Redis is up, print a claim code if the bot has no owner yet
db.once('ready', async () => {
  try {
    const code = await admins.prepareClaim({ reclaim: config.reclaim })
    if (code) console.log(`CLAIM | To become the bot owner, message it: /msg ${config.irc.nick} @claim ${code}`)
  } catch (err) {
    console.error('Could not check the bot owner', err.message)
  }
})

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
