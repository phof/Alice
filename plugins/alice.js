import { pick } from '../lib/commands.js'

const quotes = [
  '“Why, sometimes I\'ve believed as many as six impossible things before breakfast.”',
  '“Who in the world am I? Ah, that\'s the great puzzle.”',
  '“If everybody minded their own business, the world would go around a great deal faster than it does.”',
  '“Alice: How long is forever? White Rabbit: Sometimes, just one second.”',
  '“It’s no use going back to yesterday, because I was a different person then.”',
  '“I\'m afraid I can\'t explain myself, sir. Because I am not myself, you see?”',
  '“Imagination is the only weapon in the war against reality.”',
  '“Off with their heads!”',
  '“We\'re all mad here. I\'m mad. You\'re mad.”',
  '“It\'s always tea-time.”',
  '“It\'s done by everyone minding their own business.”',
  '“The more there is of mine, the less there is of yours.”'
]

export default function () {
  return {
    name: 'Alice quotes',
    commands: [{
      command: '!alice',
      helptext: 'Returns a random quote from Alice in Wonderland',
      handler: ({ reply }) => reply(pick(quotes))
    }]
  }
}
