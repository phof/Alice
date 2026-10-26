export default function ({ bot }) {
  bot.on('privmsg', (e) => {
    if (bot.network.isChannelName(e.target)) {
      console.log(`MESSAGE | Message on ${e.target} from ${e.nick}`)
    } else {
      console.log(`PM | Private message from ${e.nick}`)
    }
  })

  bot.on('join', (e) => console.log(`JOIN | ${e.nick} joined ${e.channel}`))
  bot.on('part', (e) => console.log(`PART | ${e.nick} left ${e.channel}`))
  bot.on('kick', (e) => console.log(`KICK | ${e.kicked} was kicked from ${e.channel} by ${e.nick}`))
  bot.on('quit', (e) => console.log(`QUIT | ${e.nick} quit (${e.message})`))

  bot.on('userlist', (e) => {
    const nicks = e.users.map(u => (u.modes.includes('o') ? '@' : '') + u.nick)
    console.log(`NAMES | ${e.channel} members: ${nicks.join(' ')}`)
  })

  bot.on('ctcp request', (e) => console.log(`CTCP | ${e.type} from ${e.nick}`))

  return { name: 'Simple log' }
}
