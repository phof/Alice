import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAdmins } from '../lib/admins.js'
import { createRouter } from '../lib/commands.js'
import adminCommands from '../plugins/admins.js'
import { fakeBot, message, tick } from './helpers.js'

function fakeDb () {
  const data = new Map()
  const set = (k) => { if (!data.has(k)) data.set(k, new Set()); return data.get(k) }
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => { data.set(k, v) },
    del: async (k) => Number(data.delete(k)),
    sMembers: async (k) => [...set(k)],
    sAdd: async (k, v) => { const s = set(k); const had = s.has(v); s.add(v); return had ? 0 : 1 },
    sRem: async (k, v) => Number(set(k).delete(v))
  }
}

function setup (config = { admins: [] }) {
  const bot = fakeBot()
  // answer WHOIS for carol, stay silent for anyone else (like a lagging server)
  bot.raw = (cmd, nick) => {
    if (cmd === 'WHOIS' && nick === 'carol') {
      setImmediate(() => bot.emit('whois', { nick, ident: '~carol', hostname: 'carol.example.net' }))
    }
  }
  const db = fakeDb()
  const admins = createAdmins(db, config)
  createRouter(bot, admins, [adminCommands({ bot, admins })])
  const pm = async (text, from = {}) => {
    bot.emit('privmsg', message({ target: 'Alice', message: text, ...from }))
    for (let i = 0; i < 5; i++) await tick()
    return bot.sent.at(-1)?.[2]
  }
  return { bot, db, admins, pm }
}

const owner = { nick: 'me', ident: '~me', hostname: 'home.example.org' }
const stranger = { nick: 'mallory', ident: '~m', hostname: 'evil.example' }

test('claim: one-time code makes the claimer owner', async () => {
  const { db, admins, pm } = setup()
  const code = await admins.prepareClaim()
  assert.ok(code)

  assert.match(await pm('@claim wrong', stranger), /not valid/)
  assert.match(await pm(`@claim ${code}`, owner), /owner now/)
  assert.equal(db.data.get('admin:owner'), '*!~me@home.example.org')

  // the code is spent
  assert.match(await pm(`@claim ${code}`, stranger), /not valid/)
  assert.equal(db.data.get('admin:owner'), '*!~me@home.example.org')
})

test('claim: the same code survives restarts until used', async () => {
  const { db, admins } = setup()
  const code = await admins.prepareClaim()
  const restarted = createAdmins(db, { admins: [] })
  assert.equal(await restarted.prepareClaim(), code)
  assert.notEqual(await restarted.prepareClaim({ reclaim: true }), code)
})

test('claim: no code once there is an owner, unless reclaiming', async () => {
  const { db, admins } = setup()
  db.data.set('admin:owner', '*!~me@home.example.org')
  assert.equal(await admins.prepareClaim(), null)
  assert.ok(await admins.prepareClaim({ reclaim: true }))
})

test('claim: a Redis error is not mistaken for "no owner"', async () => {
  const { db, admins } = setup()
  db.get = async () => { throw new Error('down') }
  await assert.rejects(admins.prepareClaim())
})

test('owner can add admins by nick or mask, and nobody can remove the owner', async () => {
  const { db, admins, pm } = setup()
  await admins.claim(await admins.prepareClaim(), owner)

  assert.match(await pm('@adminadd carol', owner), /Added \*!~carol@carol\.example\.net/)
  assert.match(await pm('@adminadd dave!*@*.dave.org', owner), /Added/)

  const carol = { nick: 'carol2', ident: '~carol', hostname: 'carol.example.net' }
  assert.match(await pm('@admindel *!~me@home.example.org', carol), /can't be removed/)
  assert.match(await pm('@owner *!*@*', carol), /Only the owner/)
  assert.match(await pm('@admindel dave!*@*.dave.org', carol), /Removed/)
  assert.deepEqual([...db.data.get('admins')], ['*!~carol@carol.example.net'])
})

test('@adminadd: a WHOIS timeout reports not found and cleans up', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { bot, admins, pm } = setup()
  await admins.claim(await admins.prepareClaim(), owner)
  await pm('@adminadd nobody', owner) // no WHOIS reply comes back
  assert.equal(bot.listenerCount('whois'), 1)
  t.mock.timers.tick(5000)
  for (let i = 0; i < 5; i++) await tick()
  assert.match(bot.sent.at(-1)[2], /Couldn't find/)
  assert.equal(bot.listenerCount('whois'), 0)
})

test('claim: a leftover code is discarded once there is an owner', async () => {
  const { db, admins } = setup()
  db.data.set('admin:owner', '*!~me@home.example.org')
  const code = await admins.prepareClaim({ reclaim: true })
  // restarted without BOT_RECLAIM, code never used
  assert.equal(await admins.prepareClaim(), null)
  assert.equal(await admins.claim(code, { ident: 'x', hostname: 'evil' }), null)
  assert.equal(db.data.get('admin:owner'), '*!~me@home.example.org')
})

test('strangers are refused, except for @claim', async () => {
  const { pm } = setup()
  assert.match(await pm('@adminlist', stranger), /not on the guest list/)
  assert.match(await pm('@claim nope', stranger), /not valid/)
})

test('owner can change their own mask', async () => {
  const { db, admins, pm } = setup()
  await admins.claim(await admins.prepareClaim(), owner)
  assert.match(await pm('@owner *!~me@*.example.org', owner), /Owner mask is now/)
  assert.equal(db.data.get('admin:owner'), '*!~me@*.example.org')
  assert.ok(await admins.isAdmin({ nick: 'x', ident: '~me', hostname: 'new.example.org' }))
})

test('BOT_ADMINS env masks still work', async () => {
  const { admins } = setup({ admins: ['*!*@trusted'] })
  assert.ok(await admins.isAdmin({ nick: 'a', ident: 'b', hostname: 'trusted' }))
})
