import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLimiter } from '../lib/ratelimit.js'
import { createRouter } from '../lib/commands.js'
import { fakeBot, message, tick } from './helpers.js'

test('limiter: bursts, then refills', () => {
  const limiter = createLimiter({ burst: 3, interval: 10 })
  const t = 1_000_000
  assert.ok(limiter.take('a', t).ok)
  assert.ok(limiter.take('a', t).ok)
  assert.ok(limiter.take('a', t).ok)

  const limited = limiter.take('a', t)
  assert.deepEqual(limited, { ok: false, warn: true, wait: 10 })
  assert.equal(limiter.take('a', t + 1000).warn, false) // only warned once
  assert.ok(limiter.take('b', t).ok) // other users unaffected

  assert.ok(limiter.take('a', t + 10_000).ok)
  assert.ok(!limiter.take('a', t + 10_000).ok)

  limiter.prune(t + 60_000)
  assert.equal(limiter.size, 0)
})

test('router: limits commands per user@host, warning once', async () => {
  const bot = fakeBot()
  const admins = { isAdmin: async (e) => e.hostname === 'trusted' }
  const plugin = {
    commands: [
      { command: '!ping', helptext: '', handler: ({ reply }) => reply('pong') },
      { command: '@ping', helptext: '', handler: ({ reply }) => reply('pong') }
    ]
  }
  createRouter(bot, admins, [plugin], { rateLimit: { burst: 2, interval: 60 } })
  const send = async (props) => { bot.emit('privmsg', message(props)); await tick(); await tick() }

  for (let i = 0; i < 5; i++) await send({ nick: `bob${i}`, target: '#c', message: '!ping' }) // nick changes don't help
  assert.deepEqual(bot.sent.map(s => s[0] + ' ' + s[2]), [
    'say pong',
    'say pong',
    'notice Slow down! The White Rabbit is late enough. Try again in 60s.'
  ])

  // admins aren't limited for @commands
  bot.sent.length = 0
  for (let i = 0; i < 5; i++) await send({ hostname: 'trusted', target: 'Alice', message: '@ping' })
  assert.equal(bot.sent.length, 5)
})

// A bot whose say/notice send their lines through raw(), like irc-framework's
function rawBot () {
  const bot = fakeBot()
  bot.lines = []
  bot.raw = (...args) => bot.lines.push(args.join(' '))
  bot.say = (target, message) => bot.raw('PRIVMSG', target, message)
  bot.notice = (target, message) => bot.raw('NOTICE', target, message)
  return bot
}

test('throttle: a burst of 4 lines, then one every 2 seconds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const { throttle } = await import('../lib/throttle.js')
  const bot = rawBot()
  throttle(bot)
  for (let i = 0; i < 7; i++) bot.notice('bob', `line ${i}`)
  assert.equal(bot.lines.length, 4)
  t.mock.timers.tick(2000)
  assert.equal(bot.lines.length, 5)
  t.mock.timers.tick(4000)
  assert.equal(bot.lines.length, 7)
  assert.equal(bot.lines.at(-1), 'NOTICE bob line 6')
})

test('throttle: other commands go out at once but use up the allowance', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const { throttle } = await import('../lib/throttle.js')
  const bot = rawBot()
  throttle(bot)
  for (let i = 0; i < 6; i++) bot.raw('MODE', '#c', '+b', `x${i}!*@*`)
  bot.sayNow('#c', 'stop flooding')
  assert.equal(bot.lines.length, 7) // never delayed
  bot.say('#c', 'queued')
  t.mock.timers.tick(6000)
  assert.ok(!bot.lines.includes('PRIVMSG #c queued')) // still paying for the burst
  t.mock.timers.tick(2000)
  assert.equal(bot.lines.at(-1), 'PRIVMSG #c queued')
})

test('throttle: drops lines when the queue is full, except important ones', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  t.mock.method(console, 'warn', () => {})
  const { throttle } = await import('../lib/throttle.js')
  const bot = rawBot()
  throttle(bot, { maxQueue: 2 })
  for (let i = 0; i < 10; i++) bot.say('#c', `spam ${i}`)
  bot.say('#c', 'bob: reminder', { important: true })
  t.mock.timers.tick(60_000)
  assert.deepEqual(bot.lines.map(l => l.replace('PRIVMSG #c ', '')),
    ['spam 0', 'spam 1', 'spam 2', 'spam 3', 'spam 4', 'spam 5', 'bob: reminder'])
})

test('throttle: queued lines are dropped when the connection closes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const { throttle } = await import('../lib/throttle.js')
  const bot = rawBot()
  throttle(bot)
  for (let i = 0; i < 6; i++) bot.say('#c', `line ${i}`)
  bot.emit('socket close')
  t.mock.timers.tick(60_000)
  assert.equal(bot.lines.length, 4)
})

test('config: empty or invalid numbers fall back to the default', async () => {
  const { num } = await import('../lib/config.js')
  assert.equal(num(undefined, 8), 8)
  assert.equal(num('', 8), 8)
  assert.equal(num('  ', 8), 8)
  assert.equal(num('abc', 8), 8)
  assert.equal(num('0', 8), 0)
  assert.equal(num('12', 8), 12)
})
