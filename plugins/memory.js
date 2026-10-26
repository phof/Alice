import { pick } from '../lib/commands.js'
import { scanKeys } from '../db/redis.js'

const okay = ['Okay,', 'Cool,', 'Alright,', 'Yep,', 'Sure,', 'Done,', 'Roger,', 'Fine,', 'Yes,']
const MAX_WORDS = 30

// "Alice?" and "alice," should both trigger "alice"
export const normalize = (word) => word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')

// Replacer functions, so "$&" and friends in a channel name are inserted literally
export const fill = (phrase, { nick, channel }) =>
  phrase.replace(/\$nick\b/gi, () => nick).replace(/\$channel\b/gi, () => channel)

/*
  Each word maps to a Redis set of phrases: memory:<word>
*/
export default function ({ bot, db, config }) {
  const key = (word) => `memory:${word}`
  const lastReply = new Map()

  // Memories used to be a single string per word; turn those into sets
  async function migrate () {
    for (const k of await scanKeys(db, 'memory:*')) {
      if (await db.type(k) !== 'string') continue
      const phrase = await db.get(k)
      await db.multi().del(k).sAdd(k, phrase).exec()
      console.log(`Memory: migrated ${k}`)
    }
  }
  db.on('ready', () => migrate().catch(err => console.error('Memory migration failed', err.message)))

  const phrasesOf = async (word) => (await db.sMembers(key(word))).sort()

  /*
    Reply with a remembered phrase whenever someone mentions a known word,
    at most once per cooldown per channel
  */
  bot.on('privmsg', async (e) => {
    const channel = e.target
    if (!bot.network.isChannelName(channel) || e.message.startsWith('!')) return
    const cooldownKey = bot.caseLower(channel)
    if (Date.now() - (lastReply.get(cooldownKey) ?? 0) < config.memoryCooldown * 1000) return

    const words = [...new Set(e.message.split(/\s+/).map(normalize).filter(Boolean))].slice(0, MAX_WORDS)
    if (words.length === 0) return

    try {
      const replies = (await Promise.all(words.map(w => db.sRandMember(key(w))))).filter(Boolean)
      if (replies.length === 0) return
      lastReply.set(cooldownKey, Date.now())
      // if a message mentions several known words, take a random one
      bot.say(channel, fill(pick(replies), { nick: e.nick, channel }))
    } catch (err) {
      console.error('Memory lookup failed', err.message) // not replying here to avoid channel spam
    }
  })

  return {
    name: 'Memory',
    migrate,
    commands: [{
      command: '!remember',
      usage: '!remember <word> <phrase>',
      helptext: 'Mentions of <word> will trigger a reply with <phrase>, or one of several. $nick in <phrase> becomes the speaker',
      handler: async ({ argv, args, reply }) => {
        const word = normalize(argv[0] ?? '')
        const phrase = args.slice(argv[0]?.length ?? 0).trim()
        if (!word || !phrase) return reply('Usage: !remember <word> <phrase>')
        const [added, count] = await db.multi().sAdd(key(word), phrase).sCard(key(word)).exec()
        if (!added) return reply(`I already know that one about ${word}`)
        reply(`${pick(okay)} will remember ${word}` + (count > 1 ? ` (${count} phrases)` : ''))
      }
    }, {
      command: '!forget',
      usage: '!forget <word> [number]',
      helptext: 'Forgets <word>, or only its phrase [number] from !memory <word>',
      handler: async ({ argv: [raw, n], reply }) => {
        const word = normalize(raw ?? '')
        if (!word) return reply('Usage: !forget <word> [number]')

        if (n === undefined) {
          const removed = await db.del(key(word))
          return reply(removed ? `${pick(okay)} will forget ${word}` : `${word} is not known`)
        }

        const phrase = (await phrasesOf(word))[Number(n) - 1]
        if (!phrase) return reply(`${word} has no phrase #${n}, see !memory ${word}`)
        await db.sRem(key(word), phrase)
        reply(`${pick(okay)} forgot "${phrase}"`)
      }
    }, {
      command: '!memory',
      usage: '!memory [word]',
      helptext: 'Lists known words, or the phrases for [word]',
      handler: async ({ argv: [raw], reply }) => {
        if (raw) {
          const word = normalize(raw)
          const phrases = await phrasesOf(word)
          if (phrases.length === 0) return reply(`${word} is not known`)
          return phrases.forEach((p, i) => reply(`${i + 1}. ${p}`))
        }
        const words = (await scanKeys(db, 'memory:*')).map(k => k.slice('memory:'.length))
        reply(words.length ? `Known words: ${words.join(', ')}` : 'There are no known words')
      }
    }]
  }
}
