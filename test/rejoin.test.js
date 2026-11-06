import { test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import rejoin from '../plugins/rejoin.js'
import { fakeBot } from './helpers.js'

let bot, plugin, logs

beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] })
  logs = []
  mock.method(console, 'log', (...args) => logs.push(args.join(' ')))
  mock.method(console, 'error', (...args) => logs.push(args.join(' ')))
  bot = fakeBot()
  bot.connected = true
  plugin = rejoin({ bot, config: { channels: ['#alby00', '#Other[1]'], rejoin: { interval: 300 } } })
  bot.emit('registered')
})

afterEach(() => {
  plugin.stop()
  mock.timers.reset()
  mock.restoreAll()
})

const joins = () => bot.sent.filter(s => s[0] === 'join').map(s => s[1])
const joined = (channel, nick = 'Alice') => bot.emit('join', { nick, channel })
// What irc-framework emits for numerics it has no handler for
const numeric = (command, channel, reason) => bot.emit('unknown command', { command, params: ['Alice', channel, reason] })
const seconds = (n) => mock.timers.tick(n * 1000)

test('rejoin: joins the configured channels on connect', () => {
  assert.deepEqual(joins(), ['#alby00', '#Other[1]'])
})

test('rejoin: logs 437 and retries with backoff until the join succeeds', () => {
  joined('#Other[1]')
  bot.sent = []
  numeric('437', '#alby00', 'Channel temporarily unavailable')
  assert.ok(logs.some(l => l.includes('unavailable_resource #alby00 Channel temporarily unavailable')))
  assert.ok(logs.some(l => l.includes('Could not join #alby00') && l.includes('retrying in 30s')))

  seconds(29)
  assert.deepEqual(joins(), [])
  seconds(1)
  assert.deepEqual(joins(), ['#alby00'])

  // Rejected again: the delay doubles
  numeric('437', '#alby00', 'Channel temporarily unavailable')
  seconds(59)
  assert.deepEqual(joins(), ['#alby00'])
  seconds(1)
  assert.deepEqual(joins(), ['#alby00', '#alby00'])

  // Joined: no more retries, and the periodic check leaves it alone
  joined('#alby00')
  seconds(3600)
  assert.deepEqual(joins(), ['#alby00', '#alby00'])
})

test('rejoin: backoff is capped at the check interval, one JOIN per channel per interval', () => {
  joined('#Other[1]')
  bot.sent = []
  for (let i = 0; i < 10; i++) {
    numeric('437', '#alby00', 'Channel temporarily unavailable')
    seconds(300)
  }
  // 30, 60, 120, 240, then 300s: one JOIN each round, never two at once
  assert.equal(joins().length, 10)
})

test('rejoin: errors irc-framework does report (474 etc) are retried too', () => {
  joined('#Other[1]')
  bot.sent = []
  bot.emit('irc error', { error: 'banned_from_channel', channel: '#alby00', reason: 'Cannot join channel (+b)' })
  seconds(30)
  assert.deepEqual(joins(), ['#alby00'])
})

test('rejoin: 477 is logged, other unknown numerics are ignored', () => {
  numeric('477', '#Other[1]', 'You need a registered nick')
  numeric('999', '#alby00', 'whatever')
  assert.ok(logs.some(l => l.includes('need_registered_nick #Other[1] You need a registered nick')))
  assert.ok(!logs.some(l => l.includes('whatever')))
})

test('rejoin: channels that are not configured are not retried', () => {
  joined('#alby00')
  joined('#Other[1]')
  bot.sent = []
  numeric('437', '#elsewhere', 'Channel temporarily unavailable')
  seconds(3600)
  assert.deepEqual(joins(), [])
})

test('rejoin: periodic check rejoins after a kick or a missed JOIN echo', () => {
  joined('#alby00')
  bot.sent = []
  // #Other[1] never echoed a JOIN; the startup JOIN counts toward its interval
  seconds(299)
  assert.deepEqual(joins(), [])
  seconds(1)
  assert.deepEqual(joins(), ['#Other[1]'])
  assert.ok(logs.some(l => l === 'Not in #Other[1], rejoining'))

  // casemapping: {} is the lowercase of []
  joined('#other{1}')
  bot.emit('kick', { nick: 'op', kicked: 'Alice', channel: '#ALBY00' })
  seconds(300)
  assert.deepEqual(joins(), ['#Other[1]', '#alby00'])
  seconds(300)
  // Still not back in: one more JOIN per interval
  assert.deepEqual(joins(), ['#Other[1]', '#alby00', '#alby00'])
})

test('rejoin: an @part is respected until the channel is joined again', () => {
  joined('#alby00')
  joined('#Other[1]')
  bot.emit('part', { nick: 'Alice', channel: '#alby00' })
  bot.emit('part', { nick: 'bob', channel: '#Other[1]' })
  bot.sent = []
  seconds(900)
  assert.deepEqual(joins(), [])

  // Rejoined (@join, keep_op cycling): wanted again
  joined('#alby00')
  bot.emit('kick', { nick: 'op', kicked: 'Alice', channel: '#alby00' })
  seconds(300)
  assert.deepEqual(joins(), ['#alby00'])
})

test('rejoin: a reconnect drops pending retries and joins everything afresh', () => {
  numeric('437', '#alby00', 'Channel temporarily unavailable')
  bot.connected = false
  bot.emit('socket close')
  bot.sent = []
  seconds(600)
  assert.deepEqual(joins(), [], 'nothing is sent while disconnected')

  bot.connected = true
  bot.emit('registered')
  assert.deepEqual(joins(), ['#alby00', '#Other[1]'])
})

test('rejoin: stop() cancels retries and the periodic check', () => {
  numeric('437', '#alby00', 'Channel temporarily unavailable')
  bot.sent = []
  plugin.stop()
  seconds(3600)
  assert.deepEqual(joins(), [])
})

test('rejoin: an @part while a retry is pending cancels it', () => {
  numeric('437', '#alby00', 'Channel temporarily unavailable')
  bot.emit('part', { nick: 'Alice', channel: '#alby00' })
  bot.sent = []
  seconds(3600)
  assert.ok(!joins().includes('#alby00'))
  assert.ok(!joins().includes(undefined))
})
