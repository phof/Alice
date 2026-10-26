import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRouter } from '../lib/commands.js'
import { createAdmins } from '../lib/admins.js'
import autoOp from '../plugins/auto_op.js'
import keepOp from '../plugins/keep_op.js'
import weather, { describe } from '../plugins/weather.js'
import { formatTime } from '../plugins/time.js'
import { fakeBot, message, tick } from './helpers.js'

// In-memory stand-in for the bits of the node-redis client we use
function fakeDb () {
  const data = new Map()
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => { data.set(k, v) },
    del: async (k) => Number(data.delete(k)),
    on: () => {},
    async * scanIterator ({ MATCH }) {
      const prefix = MATCH.replace('*', '')
      yield [...data.keys()].filter(k => k.startsWith(prefix))
    }
  }
}

const config = { admins: ['*!*@trusted'], defaultTopic: 'topic' }

function setup (plugin) {
  const bot = fakeBot()
  const db = fakeDb()
  const admins = createAdmins({ get: async () => null, sMembers: async () => [] }, config)
  createRouter(bot, admins, [plugin({ bot, db, config, admins })])
  const say = async (target, text, extra) => {
    bot.emit('privmsg', message({ target, message: text, ...extra }))
    for (let i = 0; i < 5; i++) await tick()
  }
  return { bot, db, say }
}

test('auto-op: ops matching hostmasks only', async () => {
  const { bot, db, say } = setup(autoOp)
  await say('Alice', '@opadd Bob bob!~bob@*.example.com', { hostname: 'trusted' })
  assert.equal(db.data.get('user:bob'), 'bob!~bob@*.example.com')

  bot.emit('join', message({ channel: '#c', nick: 'Bob', ident: '~bob', hostname: 'home.example.com' }))
  bot.emit('join', message({ channel: '#c', nick: 'Bob', ident: '~bob', hostname: 'evil.net' }))
  await tick()
  assert.deepEqual(bot.sent.filter(s => s[0] === 'raw'), [['raw', 'MODE', '#c', '+o', 'Bob']])
})

test('auto-op: the owner and admins are always opped', async () => {
  const { bot } = setup(autoOp)
  bot.emit('join', message({ channel: '#c', nick: 'boss', hostname: 'trusted' }))
  bot.emit('join', message({ channel: '#c', nick: 'rando', hostname: 'elsewhere' }))
  await tick()
  await tick()
  assert.deepEqual(bot.sent.filter(s => s[0] === 'raw'), [['raw', 'MODE', '#c', '+o', 'boss']])
})

test('auto-op: @oplist shows everyone opped on join', async () => {
  const { db, say, bot } = setup(autoOp)
  db.mGet = async (keys) => keys.map(k => db.data.get(k) ?? null)
  // only BOT_ADMINS (*!*@trusted) so far
  await say('Alice', '@oplist', { hostname: 'trusted' })
  assert.equal(bot.sent.at(-1)[2], 'Opped on join: admins *!*@trusted')

  await say('Alice', '@opadd Bob bob!~bob@*.example.com', { hostname: 'trusted' })
  await say('Alice', '@oplist', { hostname: 'trusted' })
  assert.equal(bot.sent.at(-1)[2], 'Opped on join: admins *!*@trusted · auto-op bob (bob!~bob@*.example.com)')
})

test('auto-op: @oplist includes the owner and admins from Redis', async () => {
  const bot = fakeBot()
  const db = fakeDb()
  db.mGet = async (keys) => keys.map(k => db.data.get(k) ?? null)
  const admins = {
    isAdmin: async () => true,
    owner: async () => '*!~me@home',
    admins: async () => ['*!~carol@carol.net']
  }
  createRouter(bot, admins, [autoOp({ bot, db, config: { admins: [] }, admins })])
  bot.emit('privmsg', message({ target: 'Alice', message: '@oplist' }))
  for (let i = 0; i < 5; i++) await tick()
  assert.equal(bot.sent.at(-1)[2], 'Opped on join: owner *!~me@home · admins *!~carol@carol.net')
})

test('auto-op: migrates mixed-case entries to IRC-lowercase keys', async () => {
  const { db } = setup(autoOp)
  const plugin = autoOp({ bot: fakeBot(), db, config })
  db.data.set('user:Bob', 'bob!*@*')
  db.data.set('user:Carol', 'old')
  db.data.set('user:carol', 'new')
  db.rename = async (a, b) => { db.data.set(b, db.data.get(a)); db.data.delete(a) }
  db.exists = async (k) => Number(db.data.has(k))
  await plugin.migrate()
  assert.deepEqual([...db.data.entries()].sort(), [['user:bob', 'bob!*@*'], ['user:carol', 'new']])
})

test('auto-op: rejects malformed masks', async () => {
  const { bot, db, say } = setup(autoOp)
  await say('Alice', '@opadd bob .*', { hostname: 'trusted' })
  assert.equal(db.data.size, 0)
  assert.match(bot.sent.at(-1)[2], /Usage/)
})

test('keep-op: resets the channel when alone with op, cycles without', () => {
  const { bot } = setup(keepOp)
  bot.emit('userlist', { channel: '#c', users: [{ nick: 'Alice', modes: ['o'] }] })
  assert.deepEqual(bot.sent, [['raw', 'MODE', '#c', '+sn'], ['raw', 'TOPIC', '#c', 'topic']])

  bot.sent.length = 0
  bot.emit('userlist', { channel: '#c', users: [{ nick: 'Alice', modes: [] }] })
  assert.deepEqual(bot.sent, [['part', '#c'], ['join', '#c']])
})

test('keep-op: checks names when someone leaves, batched', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { bot } = setup(keepOp)
  bot.emit('join', { channel: '#c', nick: 'Alice' })
  // a netsplit: hundreds of quits at once
  for (let i = 0; i < 300; i++) bot.emit('quit', { nick: `user${i}` })
  bot.emit('part', { channel: '#D', nick: 'bob' })
  assert.deepEqual(bot.sent, [])

  t.mock.timers.tick(3000)
  assert.deepEqual(bot.sent, [['raw', 'NAMES', '#c'], ['raw', 'NAMES', '#d']])
})

test('weather: looks up place then forecast', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    const body = String(url).includes('geocoding')
      ? { results: [{ name: 'Lisbon', country: 'Portugal', latitude: 38.7, longitude: -9.1, timezone: 'Europe/Lisbon' }] }
      : { current: { temperature_2m: 21.4, weather_code: 2 }, current_units: { temperature_2m: '°C' } }
    return new Response(JSON.stringify(body))
  })
  const { bot, say } = setup(weather)
  await say('#c', '!weather lisbon')
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(bot.sent.at(-1)[2], 'The current weather in Lisbon, Portugal is 21.4°C and partly cloudy')
  assert.equal(describe(999), 'unknown conditions')
})

test('time: formats in the given timezone', () => {
  const date = new Date('2026-10-26T12:00:00Z')
  assert.match(formatTime('Asia/Tokyo', date), /^Monday,? 26 October 2026 at 21:00:00$/)
})
