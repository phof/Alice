import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRouter } from '../lib/commands.js'
import { fakeBot, message, tick } from './helpers.js'

const config = { admins: ['admin!*@trusted.example'], adminAccounts: ['root'] }

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
  createRouter(bot, config, [plugin])
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
  assert.match(bot.sent[0][2], /not on the guest list/)
})

test('allows admins by hostmask or account', async () => {
  const { bot } = setup()
  bot.emit('privmsg', message({ nick: 'admin', hostname: 'trusted.example', target: 'Alice', message: '@secret' }))
  bot.emit('privmsg', message({ account: 'Root', target: 'Alice', message: '@secret' }))
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
