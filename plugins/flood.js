import { hostmaskOf } from '../lib/mask.js'
import { userKey } from '../lib/ratelimit.js'
import { formatDuration } from '../lib/duration.js'

const UNBANS = 'unbans'

/*
  Basic channel flood/spam protection. Offences are:
  - flooding: more than `lines` messages in `seconds`
  - repeating: the same message `repeats` times within a minute
  Each offence escalates: warn, then kick, then ban for `banMinutes`, with a short grace
  period after each step so one burst can't go straight from warning to kick.
  Offences are forgotten after 10 minutes of good behaviour. Admins are exempt.
  Kicks and bans need the bot to be a channel operator.
*/
export default function ({ bot, db, config, admins }) {
  const { lines, seconds, repeats, banMinutes } = config.flood
  const OFFENCE_MEMORY = 10 * 60_000
  const REPEAT_WINDOW = 60_000
  const GRACE = 10_000

  const activity = new Map() // channel|user -> { times: [], texts: [] }
  const offences = new Map() // channel|user -> { count, last }

  const check = async (e, now = Date.now()) => {
    const channel = e.target
    if (!config.flood.enabled || !bot.network.isChannelName(channel)) return

    const key = `${bot.caseLower(channel)}|${userKey(e)}`
    const a = activity.get(key) ?? { times: [], texts: [] }
    activity.set(key, a)

    a.times = a.times.filter(t => now - t < seconds * 1000).concat(now)
    const text = e.message.trim().toLowerCase()
    a.texts = a.texts.filter(t => now - t.time < REPEAT_WINDOW).concat({ text, time: now })

    let reason = null
    if (a.times.length > lines) reason = 'flooding'
    else if (text && a.texts.filter(t => t.text === text).length >= repeats) reason = 'repeating'
    if (!reason) return

    // one burst is one offence
    activity.delete(key)
    if (await admins.isAdmin(e)) return

    const prev = offences.get(key)
    if (prev && now - prev.last < GRACE) return
    const count = prev && now - prev.last < OFFENCE_MEMORY ? prev.count + 1 : 1
    offences.set(key, { count, last: now })
    await punish(e, channel, reason, count, now)
  }

  async function punish (e, channel, reason, count, now) {
    console.warn(`FLOOD | ${hostmaskOf(e)} ${reason} in ${channel}, offence #${count}`)

    if (count === 1) {
      bot.sayNow(channel, `${e.nick}: please stop ${reason}, or it's off with your head!`)
    } else if (count === 2) {
      bot.raw('KICK', channel, e.nick, `Stop ${reason}! Next time it's a ${formatDuration(banMinutes * 60_000)} ban.`)
    } else {
      const mask = `*!*@${e.hostname}`
      bot.raw('MODE', channel, '+b', mask)
      bot.raw('KICK', channel, e.nick, `Off with their head! Banned for ${formatDuration(banMinutes * 60_000)} for ${reason}.`)
      try {
        await db.zAdd(UNBANS, { score: now + banMinutes * 60_000, value: JSON.stringify({ channel, mask }) })
      } catch (err) {
        console.error(`Could not schedule unban of ${mask} on ${channel}, remove it by hand`, err.message)
      }
    }
  }

  // Lift expired bans. Stored in Redis so a restart doesn't leave bans in place forever
  async function liftBans (now = Date.now()) {
    if (!db.isReady || !bot.connected) return
    for (const raw of await db.zRangeByScore(UNBANS, 0, now)) {
      if (!await db.zRem(UNBANS, raw)) continue
      const { channel, mask } = JSON.parse(raw)
      console.log(`FLOOD | Lifting ban on ${mask} in ${channel}`)
      bot.raw('MODE', channel, '-b', mask)
    }
  }

  const onMessage = (e) => check(e).catch(err => console.error('Flood check failed', err.message))
  bot.on('privmsg', onMessage)
  bot.on('action', onMessage)
  bot.on('notice', onMessage)

  setInterval(() => liftBans().catch(err => console.error('Unban failed', err.message)), 30_000).unref()

  // Forget stale tracking so memory doesn't grow forever
  setInterval(() => {
    const now = Date.now()
    for (const [key, a] of activity) {
      if (a.texts.every(t => now - t.time > REPEAT_WINDOW)) activity.delete(key)
    }
    for (const [key, o] of offences) {
      if (now - o.last > OFFENCE_MEMORY) offences.delete(key)
    }
  }, 60_000).unref()

  return { name: 'Flood protection', check, liftBans }
}
