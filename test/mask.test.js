import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchMask, isValidMask } from '../lib/mask.js'

test('matches hostmask globs', () => {
  assert.ok(matchMask('alice!~alice@*.example.com', 'Alice!~alice@host.example.com'))
  assert.ok(matchMask('*!*@cloaked/user/alice', 'whoever!x@cloaked/user/alice'))
  assert.ok(matchMask('al?ce!*@*', 'alice!x@y'))
})

test('treats regex characters literally', () => {
  assert.ok(!matchMask('alice!~alice@host.example.com', 'alice!~alice@hostXexample.com'))
  assert.ok(!matchMask('.*', 'mallory!m@evil.example'))
})

test('validates mask shape', () => {
  assert.ok(isValidMask('nick!~user@localhost'))
  assert.ok(!isValidMask('.*'))
  assert.ok(!isValidMask('nick@host'))
})
