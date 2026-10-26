const env = process.env

export default function () {
  return {
    name: 'Pushover',
    commands: [{
      command: '!push',
      usage: '!push <message>',
      helptext: 'Sends a Pushover.net message to the bot owner',
      handler: async ({ nick, args, reply }) => {
        if (!args) return reply('Usage: !push <message>')
        const res = await fetch('https://api.pushover.net/1/messages.json', {
          method: 'POST',
          body: new URLSearchParams({
            token: env.PUSHOVER_TOKEN || '',
            user: env.PUSHOVER_USER || '',
            title: `New IRC message from ${nick}`,
            message: args,
            sound: 'magic'
          }),
          signal: AbortSignal.timeout(10_000)
        })
        if (!res.ok) throw new Error(`Pushover replied ${res.status}: ${await res.text()}`)
        reply('Message sent!')
      }
    }]
  }
}
