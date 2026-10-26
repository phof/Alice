import { pick } from '../lib/commands.js'
import { createLimiter } from '../lib/ratelimit.js'
import { formatDuration } from '../lib/duration.js'

// For someone the bot has never seen in the channel
export const greetings = [
  'Welcome to $channel, $nick! We\'re all mad here.',
  'Curiouser and curiouser... a new face! Hello, $nick.',
  '$nick fell down the rabbit hole and landed in $channel. Welcome!',
  'Why, it\'s $nick! Do come in, it\'s always tea-time here.',
  'Hello $nick! Mind the Queen of Hearts, and welcome to $channel.',
  'A new guest at the tea party! Pull up a chair, $nick.',
  'Welcome, $nick! Who in the world are you? Ah, that\'s the great puzzle.',
  '$nick has arrived, and only slightly late. Welcome to $channel!'
]

// For someone coming back after a while ($away is how long, i.e. "4d 2h")
export const welcomeBacks = [
  'Welcome back, $nick! It\'s been $away.',
  'Oh my ears and whiskers, $nick is back after $away!',
  '$nick returns from Wonderland after $away. Tea?',
  'There you are, $nick! The Hatter saved your seat for $away.',
  'Welcome back to $channel, $nick. It\'s no use going back to yesterday, but we\'re glad you\'re here today.',
  '$nick! We\'ve been painting the roses red for $away waiting for you.'
]

// Replacer function, so "$&" and friends in a channel name are inserted literally
export const fill = (text, vars) => text.replace(/\$(nick|channel|away)\b/g, (match, name) => vars[name] ?? match)

const DAY = 24 * 3600 * 1000
const YEAR = 365 * 24 * 3600

/*
  Greets people joining a channel the first time the bot sees them there, and again
  when they come back after `afterDays` days away. Being in the channel, talking or
  leaving all count as being seen, so rejoining after a netsplit doesn't trigger a greeting.
  At most a few greetings per channel at a time, so a join flood doesn't make the bot flood.
*/
export default function ({ bot, db, config }) {
  const { enabled, afterDays } = config.greet
  const limiter = createLimiter({ burst: 3, interval: 20 })
  setInterval(() => limiter.prune(), 60_000).unref()

  const key = (channel, nick) => `greet:${bot.caseLower(channel)}:${bot.caseLower(nick)}`
  const isMe = (nick) => bot.caseCompare(nick, bot.user.nick)
  const log = (err) => console.error('Greet update failed', err.message)

  const touch = (channel, nick, now = Date.now()) => {
    if (!isMe(nick)) db.set(key(channel, nick), String(now), { EX: YEAR }).catch(log)
  }

  async function onJoin (e, now = Date.now()) {
    if (isMe(e.nick)) return
    const k = key(e.channel, e.nick)
    const [last] = await db.multi().get(k).set(k, String(now), { EX: YEAR }).exec()
    if (!enabled) return

    const away = last ? now - Number(last) : null
    let message
    if (away === null) message = pick(greetings)
    else if (away >= afterDays * DAY) message = pick(welcomeBacks)
    else return

    if (!limiter.take(bot.caseLower(e.channel), now).ok) return
    bot.say(e.channel, fill(message, { nick: e.nick, channel: e.channel, away: formatDuration(away ?? 0) }))
  }

  bot.on('join', (e) => onJoin(e).catch(log))
  bot.on('privmsg', (e) => { if (bot.network.isChannelName(e.target)) touch(e.target, e.nick) })
  bot.on('action', (e) => { if (bot.network.isChannelName(e.target)) touch(e.target, e.nick) })
  bot.on('part', (e) => touch(e.channel, e.nick))
  bot.on('kick', (e) => touch(e.channel, e.kicked))
  // Everyone listed is in the channel right now. This also covers people already
  // there when the bot joins, so they aren't greeted as newcomers later
  bot.on('userlist', ({ channel, users }) => {
    const now = Date.now()
    for (const u of users) touch(channel, u.nick, now)
  })

  return { name: 'Greetings', onJoin }
}
