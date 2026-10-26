/*
  Plugin tests against a real Redis. Uses TEST_REDIS_URL, by default database 15 on
  localhost, which is FLUSHED before each test. Skipped if Redis isn't reachable.
*/
import { test, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from 'redis'
import { createRouter } from '../lib/commands.js'
import { createAdmins } from '../lib/admins.js'
import { parseDuration, formatDuration } from '../lib/duration.js'
import memory, { normalize, fill } from '../plugins/memory.js'
import seen from '../plugins/seen.js'
import tell from '../plugins/tell.js'
import remind from '../plugins/remind.js'
import flood from '../plugins/flood.js'
import simpleAdmin from '../plugins/simple_admin.js'
import greet, { greetings, welcomeBacks, fill as fillGreeting } from '../plugins/greet.js'
import { fakeBot, message } from './helpers.js'

const db = createClient({ url: process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379/15', disableOfflineQueue: true })
db.on('error', () => {})
let skip = false

before(async () => {
  try {
    await Promise.race([db.connect(), new Promise((resolve, reject) => setTimeout(reject, 1000))])
  } catch {
    skip = 'Redis not reachable, set TEST_REDIS_URL'
  }
})
beforeEach(async () => { if (!skip) await db.flushDb() })
after(async () => { if (db.isOpen) await db.close(); else db.destroy() })

const config = {
  admins: ['*!*@trusted'],
  quitMessage: "We're all mad here.",
  memoryCooldown: 2,
  flood: { enabled: true, lines: 8, seconds: 6, repeats: 4, banMinutes: 15 },
  greet: { enabled: true, afterDays: 3 }
}

function setup (...plugins) {
  const bot = fakeBot()
  bot.connected = true
  const admins = createAdmins(db, config)
  const loaded = plugins.map(p => p({ bot, db, config, admins }))
  createRouter(bot, admins, loaded, { rateLimit: { burst: 1000, interval: 1 } })
  // Sends a message and waits for the bot to settle (no new output for 50ms)
  const say = async (text, nick = 'bob', target = '#c', extra = {}) => {
    bot.emit('privmsg', message({ nick, target, message: text, ...extra }))
    let count = -1
    while (count !== bot.sent.length) {
      count = bot.sent.length
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    return bot.sent.at(-1)?.[2]
  }
  return { bot, say, plugins: loaded }
}

const redisTest = (name, fn) => test(name, async (t) => {
  if (skip) return t.skip(skip)
  await fn(t)
})

test('durations', () => {
  assert.deepEqual(parseDuration('in 2h take tea'), { ms: 7_200_000, rest: 'take tea' })
  assert.deepEqual(parseDuration('1h 30m stand up'), { ms: 5_400_000, rest: 'stand up' })
  assert.deepEqual(parseDuration('10 minutes call mum'), { ms: 600_000, rest: 'call mum' })
  assert.equal(parseDuration('tomorrow call mum'), null)
  assert.equal(formatDuration(7_380_000), '2h 3m')
  assert.equal(formatDuration(45_000), '45s')
})

test('memory: helpers', () => {
  assert.equal(normalize('Alice?!'), 'alice')
  assert.equal(fill('Hello $nick, welcome to $channel', { nick: 'bob', channel: '#c' }), 'Hello bob, welcome to #c')
  assert.equal(fill('in $channel', { nick: 'bob', channel: "#a$&b$'" }), "in #a$&b$'")
})

redisTest('memory: several phrases, $nick, forget one or all', async () => {
  const { bot, say } = setup(memory)
  assert.match(await say('!remember tea It is always tea-time, $nick'), /will remember tea$/)
  assert.match(await say('!remember Tea Off with their heads!'), /\(2 phrases\)/)
  assert.match(await say('!remember tea Off with their heads!'), /already know/)

  bot.sent.length = 0
  await say('anyone for tea?', 'carol')
  assert.ok(['It is always tea-time, carol', 'Off with their heads!'].includes(bot.sent[0][2]))

  bot.sent.length = 0
  await say('!memory tea')
  assert.deepEqual(bot.sent.map(s => s[2]), ['1. It is always tea-time, $nick', '2. Off with their heads!'])

  assert.match(await say('!forget tea 2'), /forgot "Off with their heads!"/)
  assert.match(await say('!forget tea 5'), /no phrase #5/)
  assert.match(await say('!forget tea'), /will forget tea/)
  assert.equal(await db.exists('memory:tea'), 0)
})

redisTest('memory: cooldown per channel', async () => {
  const { bot, say } = setup(memory)
  await say('!remember tea Tea!')
  bot.sent.length = 0
  await say('tea')
  await say('tea again')
  await say('tea', 'bob', '#C') // same channel, different case
  await say('tea', 'bob', '#other')
  assert.deepEqual(bot.sent, [['say', '#c', 'Tea!'], ['say', '#other', 'Tea!']])
})

redisTest('memory: migrates old single-phrase memories', async () => {
  const { plugins } = setup(memory)
  await db.set('memory:hatter', 'Why is a raven like a writing-desk?')
  await plugins[0].migrate()
  assert.deepEqual(await db.sMembers('memory:hatter'), ['Why is a raven like a writing-desk?'])
})

redisTest('seen: messages and events', async () => {
  const { bot, say } = setup(seen)
  assert.equal(await say('!seen carol'), "I haven't seen carol")
  await say('hello there', 'Carol')
  assert.match(await say('!seen CAROL'), /^Carol was last seen \d+s ago in #c, saying: hello there$/)

  bot.emit('quit', { nick: 'Carol', message: 'bye' })
  assert.match(await say('!seen carol'), /^Carol was last seen \d+s ago quitting \(bye\)$/)

  // private messages are not recorded
  await say('secret', 'dave', 'Alice')
  assert.equal(await say('!seen dave'), "I haven't seen dave")
  assert.match(await say('!seen bob'), /mirror/)
})

redisTest('tell: delivered once when the person speaks', async () => {
  const { bot, say } = setup(tell)
  assert.match(await say('!tell Carol the Queen wants to see you'), /I'll tell Carol/)
  assert.match(await say('!tell bob hi'), /yourself/)

  bot.sent.length = 0
  await say('morning all', 'carol')
  assert.match(bot.sent[0][2], /^carol: bob said \d+s ago: the Queen wants to see you$/)

  bot.sent.length = 0
  await say('still here', 'carol')
  assert.deepEqual(bot.sent, [])
})

redisTest('tell: limits pending messages', async () => {
  const { say } = setup(tell)
  for (let i = 0; i < 10; i++) await say(`!tell carol ${i}`)
  assert.match(await say('!tell carol one too many'), /already has 10 messages/)
})

redisTest('remind: stored in Redis and delivered when due', async () => {
  const { bot, say, plugins } = setup(remind)
  assert.match(await say('!remind tomorrow tea'), /Usage/)
  assert.match(await say('!remind in 2h'), /Usage/)
  assert.match(await say('!remind in 2h take the tea out'), /remind you in 2h$/)
  assert.equal(await db.zCard('reminders'), 1)

  const { deliverDue } = plugins[0]
  bot.sent.length = 0
  await deliverDue(Date.now() + 3_600_000)
  assert.deepEqual(bot.sent, [])

  await deliverDue(Date.now() + 7_300_000)
  assert.match(bot.sent[0][2], /^bob: reminder from 2h \dm ago: take the tea out$/)
  assert.equal(bot.sent[0][1], '#c')
  assert.equal(await db.zCard('reminders'), 0)
})

redisTest('remind: limit is per ident@host, not per nick', async () => {
  const { say } = setup(remind)
  for (let i = 0; i < 20; i++) await say(`!remind 1h tea ${i}`, `bob${i}`)
  assert.match(await say('!remind 1h one more', 'bobby'), /already have 20 reminders/)
  assert.match(await say('!remind 1h mine', 'carol', '#c', { ident: 'carol', hostname: 'carol.example' }), /I'll remind you/)
})

redisTest('remind: kept while the bot is offline', async () => {
  const { bot, say, plugins } = setup(remind)
  await say('!remind 1m stretch')
  bot.connected = false
  await plugins[0].deliverDue(Date.now() + 120_000)
  assert.equal(await db.zCard('reminders'), 1)
})

redisTest('flood: warns, kicks, then bans with a timed unban', async () => {
  const { bot, plugins } = setup(flood)
  const { check, liftBans } = plugins[0]
  const spammer = message({ nick: 'mallory', ident: '~m', hostname: 'evil.example', target: '#c' })
  let now = Date.now()
  const burst = async () => {
    now += 11_000 // past the grace period
    for (let i = 0; i < 9; i++) await check({ ...spammer, message: `line ${i}` }, now++)
  }

  await burst()
  assert.match(bot.sent.at(-1)[2], /^mallory: please stop flooding/)
  await burst()
  assert.deepEqual(bot.sent.at(-1).slice(0, 4), ['raw', 'KICK', '#c', 'mallory'])

  bot.sent.length = 0
  await burst()
  assert.deepEqual(bot.sent[0], ['raw', 'MODE', '#c', '+b', '*!*@evil.example'])
  assert.equal(await db.zCard('unbans'), 1)

  await liftBans(now + 14 * 60_000)
  assert.equal(await db.zCard('unbans'), 1)
  bot.sent.length = 0

  // the unban is sent 3 times, 10 minutes apart, in case the bot had lost op
  for (const minutes of [16, 27, 38]) await liftBans(now + minutes * 60_000)
  const unbans = bot.sent.filter(s => s[2] === '#c' && s[3] === '-b')
  assert.equal(unbans.length, 3)
  assert.equal(await db.zCard('unbans'), 0)
})

redisTest('flood: grace period after a warning', async () => {
  const { bot, plugins } = setup(flood)
  const now = Date.now()
  // 20 lines in one go: warned once, not kicked
  for (let i = 0; i < 20; i++) await plugins[0].check(message({ target: '#c', message: `x${i}` }), now + i)
  assert.equal(bot.sent.length, 1)
  assert.match(bot.sent[0][2], /please stop flooding/)
})

redisTest('flood: repeated messages, normal chat and admins', async () => {
  const { bot, plugins } = setup(flood)
  const { check } = plugins[0]
  const now = Date.now()

  // normal conversation: 8 lines spread over a minute
  for (let i = 0; i < 8; i++) await check(message({ target: '#c', message: `hi ${i}` }), now + i * 7000)
  assert.deepEqual(bot.sent, [])

  // the same message 4 times within a minute
  for (let i = 0; i < 4; i++) await check(message({ nick: 'eve', ident: 'e', target: '#c', message: 'BUY CHEAP TEA' }), now + i * 10_000)
  assert.match(bot.sent.at(-1)[2], /^eve: please stop repeating/)

  // admins are exempt
  bot.sent.length = 0
  for (let i = 0; i < 20; i++) await check(message({ hostname: 'trusted', target: '#c', message: 'x' }), now + i)
  assert.deepEqual(bot.sent, [])
})

const DAY = 24 * 3600 * 1000
const joiner = (nick, channel = '#c') => ({ nick, ident: `~${nick}`, hostname: 'example.com', channel })
// Turns a greeting template into a regex that matches it filled in
const templateRegex = (template, vars) =>
  new RegExp('^' + fillGreeting(template, vars).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('AWAY', '.+') + '$')
const isOneOf = (text, templates, vars) => templates.some(t => templateRegex(t, vars).test(text))

test('greet: fill', () => {
  assert.equal(fillGreeting('Hi $nick, welcome to $channel ($away)', { nick: 'bob', channel: '#a$&b', away: '3d' }), 'Hi bob, welcome to #a$&b (3d)')
})

redisTest('greet: first time, not again soon, welcome back after 3 days', async () => {
  const { bot, plugins } = setup(greet)
  const { onJoin } = plugins[0]
  const now = Date.now()

  await onJoin(joiner('Carol'), now)
  assert.equal(bot.sent.length, 1)
  assert.equal(bot.sent[0][1], '#c')
  assert.ok(isOneOf(bot.sent[0][2], greetings, { nick: 'Carol', channel: '#c' }), bot.sent[0][2])

  // rejoins within 3 days: nothing
  await onJoin(joiner('carol'), now + DAY)
  await onJoin(joiner('CAROL'), now + 3 * DAY)
  assert.equal(bot.sent.length, 1)

  // back after more than 3 days away
  await onJoin(joiner('Carol'), now + 6.5 * DAY)
  assert.equal(bot.sent.length, 2)
  assert.ok(isOneOf(bot.sent[1][2], welcomeBacks, { nick: 'Carol', channel: '#c', away: 'AWAY' }), bot.sent[1][2])
  assert.match(bot.sent[1][2], /3d 12h|Welcome back to #c/)

  // channels are separate
  await onJoin(joiner('Carol', '#other'), now + 6.5 * DAY)
  assert.equal(bot.sent.length, 3)
  assert.equal(bot.sent[2][1], '#other')
})

redisTest('greet: people already there, talking or leaving count as seen', async () => {
  const { bot, plugins, say } = setup(greet)
  const { onJoin } = plugins[0]
  bot.emit('userlist', { channel: '#c', users: [{ nick: 'Alice', modes: ['o'] }, { nick: 'dave', modes: [] }] })
  await say('hello', 'erin')
  bot.emit('part', { channel: '#c', nick: 'frank' })
  await new Promise(resolve => setTimeout(resolve, 50))

  for (const nick of ['dave', 'erin', 'frank']) await onJoin(joiner(nick))
  await onJoin(joiner('Alice')) // the bot itself
  assert.deepEqual(bot.sent, [])
})

redisTest('greet: a join flood gets at most 3 greetings', async () => {
  const { bot, plugins } = setup(greet)
  const now = Date.now()
  for (let i = 0; i < 20; i++) await plugins[0].onJoin(joiner(`bot${i}`), now + i)
  assert.equal(bot.sent.length, 3)
})

redisTest('greet: GREET=false records but stays quiet', async () => {
  const bot = fakeBot()
  const quiet = greet({ bot, db, config: { ...config, greet: { enabled: false, afterDays: 3 } } })
  await quiet.onJoin(joiner('gina'))
  assert.deepEqual(bot.sent, [])
  assert.ok(await db.exists('greet:#c:gina'))
})

function adminSetup () {
  const bot = fakeBot()
  bot.sayNow = bot.say
  const admins = createAdmins(db, { admins: ['*!*@trusted'] })
  const shutdowns = []
  const shutdown = async (...args) => { shutdowns.push(args) }
  createRouter(bot, admins, [simpleAdmin({ bot, db, config, admins, shutdown })], { rateLimit: { burst: 1000, interval: 1 } })
  const pm = async (text, from) => {
    bot.emit('privmsg', message({ target: 'Alice', message: text, ...from }))
    await new Promise(resolve => setTimeout(resolve, 100))
    return bot.sent.at(-1)?.[2]
  }
  return { bot, pm, shutdowns }
}
const theOwner = { nick: 'me', ident: '~me', hostname: 'home.example.org' }
const anAdmin = { nick: 'adm', ident: '~a', hostname: 'trusted' }

redisTest('@flushdb: owner only, needs confirm, keeps the owner', async () => {
  const { pm } = adminSetup()
  await db.set('admin:owner', '*!~me@home.example.org')
  await db.sAdd('memory:tea', 'Tea!')
  await db.sAdd('admins', '*!*@friend')

  assert.match(await pm('@flushdb confirm', anAdmin), /Only the owner/)
  assert.match(await pm('@flushdb', theOwner), /Send "@flushdb confirm"/)
  assert.equal(await db.exists('memory:tea'), 1)

  assert.match(await pm('@flushdb confirm', theOwner), /still the owner/)
  assert.deepEqual((await db.keys('*')).sort(), ['admin:owner'])
  assert.equal(await db.get('admin:owner'), '*!~me@home.example.org')
})

redisTest('@disconnect: stops the bot with exit code 0 and the quit message', async () => {
  const { pm, shutdowns } = adminSetup()
  assert.match(await pm('@disconnect', anAdmin), /systemctl start alice/)
  assert.deepEqual(shutdowns, [[0, config.quitMessage]])
})
