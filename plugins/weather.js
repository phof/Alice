import { geocode, placeName } from '../lib/geo.js'
import { getJSON } from '../lib/http.js'

// WMO weather interpretation codes, as returned by Open-Meteo
const conditions = {
  0: 'clear sky',
  1: 'mainly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'foggy',
  48: 'foggy with rime',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  56: 'freezing drizzle',
  57: 'heavy freezing drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'freezing rain',
  67: 'heavy freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'light showers',
  81: 'showers',
  82: 'violent showers',
  85: 'snow showers',
  86: 'heavy snow showers',
  95: 'thunderstorms',
  96: 'thunderstorms with hail',
  99: 'thunderstorms with heavy hail'
}

export const describe = (code) => conditions[code] ?? 'unknown conditions'

export default function () {
  return {
    name: 'Weather',
    commands: [{
      command: '!weather',
      usage: '!weather <place>',
      helptext: 'Returns the current weather at <place>',
      handler: async ({ args, reply }) => {
        if (!args) return reply('Usage: !weather <place>')
        const place = await geocode(args)
        if (!place) return reply(`Oops, couldn't find ${args}`)

        const url = new URL('https://api.open-meteo.com/v1/forecast')
        url.search = new URLSearchParams({
          latitude: place.latitude,
          longitude: place.longitude,
          current: 'temperature_2m,weather_code',
          timezone: 'auto'
        })
        const { current, current_units: units } = await getJSON(url)
        reply(`The current weather in ${placeName(place)} is ${current.temperature_2m}${units.temperature_2m} and ${describe(current.weather_code)}`)
      }
    }]
  }
}
