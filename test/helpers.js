import { EventEmitter } from 'node:events'

// Minimal stand-in for an irc-framework Client
export function fakeBot () {
  const bot = new EventEmitter()
  bot.user = { nick: 'Alice' }
  bot.network = { isChannelName: (name) => /^[#&]/.test(name) }
  bot.caseLower = (s) => s.toLowerCase()
  bot.caseCompare = (a, b) => a.toLowerCase() === b.toLowerCase()
  bot.sent = []
  bot.say = (target, message) => bot.sent.push(['say', target, message])
  bot.sayNow = bot.say
  bot.notice = (target, message) => bot.sent.push(['notice', target, message])
  bot.raw = (...args) => bot.sent.push(['raw', ...args])
  bot.join = (channel) => bot.sent.push(['join', channel])
  bot.part = (channel) => bot.sent.push(['part', channel])
  return bot
}

export const message = (props) => ({ nick: 'bob', ident: '~bob', hostname: 'bob.example.com', ...props })

export const tick = () => new Promise(resolve => setImmediate(resolve))
