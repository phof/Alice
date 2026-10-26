import { pick } from '../lib/commands.js'
import { scanKeys } from '../db/redis.js'

const okay = ['Okay,', 'Cool,', 'Alright,', 'Yep,', 'Sure,', 'Done,', 'Roger,', 'Fine,', 'Yes,']

// "Alice?" and "alice," should both trigger "alice"
export const normalize = (word) => word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')

export default function ({ bot, db }) {
  /*
    Reply with a remembered phrase whenever someone mentions a known word
  */
  bot.on('privmsg', async (e) => {
    if (!bot.network.isChannelName(e.target) || e.message.startsWith('!')) return

    const words = [...new Set(e.message.split(/\s+/).map(normalize).filter(Boolean))]
    if (words.length === 0) return

    try {
      const replies = (await db.mGet(words.map(w => `memory:${w}`))).filter(Boolean)
      // if a message mentions several known words, take a random one
      if (replies.length > 0) bot.say(e.target, pick(replies))
    } catch (err) {
      console.error('Memory lookup failed', err.message) // not replying here to avoid channel spam
    }
  })

  return {
    name: 'Memory',
    commands: [{
      command: '!remember',
      usage: '!remember <word> <phrase>',
      helptext: 'Public mentions of <word> will trigger a reply with <phrase>',
      handler: async ({ argv, args, reply }) => {
        const word = normalize(argv[0] ?? '')
        const phrase = args.slice(argv[0]?.length ?? 0).trim()
        if (!word || !phrase) return reply('Usage: !remember <word> <phrase>')
        await db.set(`memory:${word}`, phrase)
        reply(`${pick(okay)} will remember ${word}`)
      }
    }, {
      command: '!forget',
      usage: '!forget <word>',
      helptext: 'Forgets <word>',
      handler: async ({ argv, reply }) => {
        const word = normalize(argv[0] ?? '')
        if (!word) return reply('Usage: !forget <word>')
        const removed = await db.del(`memory:${word}`)
        reply(removed ? `${pick(okay)} will forget ${word}` : `${word} is not known`)
      }
    }, {
      command: '!memory',
      helptext: 'Lists known words',
      handler: async ({ reply }) => {
        const words = (await scanKeys(db, 'memory:*')).map(k => k.slice('memory:'.length))
        reply(words.length ? `Known words: ${words.join(', ')}` : 'There are no known words')
      }
    }]
  }
}
