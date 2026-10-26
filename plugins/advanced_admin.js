export default function ({ bot, db, config }) {
  return {
    name: 'Advanced admin',
    commands: [{
      command: '@flushdb',
      helptext: 'Flushes Redis DB (deletes ALL keys, including memory and auto-op)',
      handler: async ({ nick, reply }) => {
        console.log(`${nick} requested a Redis flush`)
        await db.flushDb()
        reply('Flushed Redis DB')
      }
    }, {
      command: '@disconnect',
      helptext: 'Disconnects the bot from the network',
      handler: ({ nick, reply }) => {
        console.log(`${nick} requested bot to disconnect`)
        reply('Disconnecting')
        bot.quit(config.quitMessage)
      }
    }]
  }
}
