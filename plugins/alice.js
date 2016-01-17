'use strict'

module.exports = function (bot) {
  const re = /!alice/i
  const quotes = [
    `“Why, sometimes I've believed as many as six impossible things before breakfast.”`,
    `“Who in the world am I? Ah, that's the great puzzle.”`,
    `“If everybody minded their own business, the world would go around a great deal faster than it does.”`,
    `“Alice:How long is forever? White Rabbit:Sometimes, just one second.”`,
    `“It’s no use going back to yesterday, because I was a different person then.”`,
    `“I'm afraid I can't explain myself, sir. Because I am not myself, you see?”`,
    '“Imagination is the only weapon in the war against reality.”',
    '“Off with their heads!”',
    `“We're all mad here. Im mad. You're mad”`,
    `“It's always tea-time.”`,
    `“It's done by everyone minding their own business”`,
    `“The more there is of mine, the less there is of yours”`
  ]

  bot.on('message#', function (nick, to, text) {
    let rand_quote = quotes[Math.floor(Math.random() * quotes.length)]

    if (re.test(text)) {
      console.log(`Sending message to ${to}: ${rand_quote}`)
      bot.say(to, rand_quote)
      return
    }
  })

  return {
    actions: [{
      command: '!alice',
      helptext: 'Returns a random quote from Alice in Wonderland'
    }]
  }
}
