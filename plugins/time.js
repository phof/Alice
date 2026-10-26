import { geocode, placeName } from '../lib/geo.js'

export function formatTime (timeZone, date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'medium',
    hourCycle: 'h23'
  }).format(date)
}

export default function () {
  return {
    name: 'Time',
    commands: [{
      command: '!time',
      usage: '!time <place>',
      helptext: 'Returns the current date and time at <place>',
      handler: async ({ args, reply }) => {
        if (!args) return reply('Usage: !time <place>')
        const place = await geocode(args)
        if (!place?.timezone) return reply(`Oops, couldn't find ${args}`)
        reply(`The time in ${placeName(place)} is ${formatTime(place.timezone)}`)
      }
    }]
  }
}
