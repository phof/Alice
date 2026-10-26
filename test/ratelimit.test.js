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

test('throttle: spaces out lines and drops them when the queue is full', async (t) => {
  t.mock.method(console, 'warn', () => {})
  const { throttle } = await import('../lib/throttle.js')
  const bot = fakeBot()
  throttle(bot, { delay: 1, maxQueue: 3 })
  for (let i = 0; i < 10; i++) bot.say('#c', `line ${i}`)
  await new Promise(resolve => setTimeout(resolve, 50))
  // the first line goes out immediately, three more were queued
  assert.deepEqual(bot.sent.map(s => s[2]), ['line 0', 'line 1', 'line 2', 'line 3'])
})

test('throttle: important lines are queued even when the queue is full', async (t) => {
  t.mock.method(console, 'warn', () => {})
  const { throttle } = await import('../lib/throttle.js')
  const bot = fakeBot()
  throttle(bot, { delay: 1, maxQueue: 2 })
  for (let i = 0; i < 5; i++) bot.say('#c', `spam ${i}`)
  bot.say('#c', 'bob: reminder', { important: true })
  await new Promise(resolve => setTimeout(resolve, 50))
  assert.deepEqual(bot.sent.map(s => s[2]), ['spam 0', 'spam 1', 'spam 2', 'bob: reminder'])
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
