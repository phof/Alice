import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRouter } from '../lib/commands.js'
import { createAdmins } from '../lib/admins.js'
import { fakeBot, message, tick } from './helpers.js'

const db = { get: async () => null, sMembers: async () => ['*!*@root.example'] }
const admins = createAdmins(db, { admins: ['admin!*@trusted.example'] })

function setup () {
  const bot = fakeBot()
  const calls = []
  const plugin = {
    commands: [
      { command: '!echo', helptext: 'echo', handler: (ctx) => { calls.push(ctx.args); ctx.reply(ctx.args) } },
      { command: '@secret', helptext: 'admin only', handler: (ctx) => ctx.reply('ok') },
      { command: '!boom', helptext: 'throws', handler: async () => { throw new Error('boom') } }
    ]
  }
  createRouter(bot, admins, [plugin])
  return { bot, calls }
}

test('routes channel commands only at the start of a message', async () => {
  const { bot, calls } = setup()
  bot.emit('privmsg', message({ target: '#chan', message: 'say !echo hi' }))
  bot.emit('privmsg', message({ target: '#chan', message: '!ECHO hello world' }))
  await tick()
  assert.deepEqual(calls, ['hello world'])
  assert.deepEqual(bot.sent, [['say', '#chan', 'hello world']])
})

test('refuses admin commands from strangers', async () => {
  const { bot } = setup()
  bot.emit('privmsg', message({ target: 'Alice', message: '@secret' }))
  await tick()
  await tick()
  assert.match(bot.sent[0][2], /not on the guest list/)
})

test('allows admins from env or Redis', async () => {
  const { bot } = setup()
  bot.emit('privmsg', message({ nick: 'admin', hostname: 'trusted.example', target: 'Alice', message: '@secret' }))
  bot.emit('privmsg', message({ hostname: 'root.example', target: 'Alice', message: '@secret' }))
  await tick()
  assert.deepEqual(bot.sent, [['say', 'admin', 'ok'], ['say', 'bob', 'ok']])
})

test('reports handler errors instead of crashing', async (t) => {
  t.mock.method(console, 'error', () => {})
  const { bot } = setup()
  bot.emit('privmsg', message({ target: '#chan', message: '!boom' }))
  await tick()
  assert.match(bot.sent[0][2], /something went wrong/)
})

test('help lists public commands via notice', async () => {
  const { bot } = setup()
  bot.emit('privmsg', message({ target: '#chan', message: '!help' }))
  await tick()
  assert.ok(bot.sent.every(([type, to]) => type === 'notice' && to === 'bob'))
  assert.ok(bot.sent.some(([, , text]) => text.startsWith('!echo')))
  assert.ok(!bot.sent.some(([, , text]) => text.startsWith('@')))
})
