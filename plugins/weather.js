'use strict'

const Yql = require('yql')

module.exports = (bot) => {
  const re = /(!weather) (.+$)/i
  const query = "select * from weather.forecast where woeid in (select woeid from geo.places(1) where text=@city) and u='c'"

  bot.on('message#', (nick, to, text) => {
    let match = text.match(re)

    if (match) {
      let cityname = match[2]
      Yql(query).setParam('city', cityname).exec((err, response) => {
        if (err) {
          console.error(`Error while trying to retrieve weather data for ${cityname}`, err)
          bot.say(to, `Ugh, error while trying to retrieve weather data for ${cityname}`)
        } else {
          let results = response.query.results
          if (results !== null && typeof results.channel !== 'undefined' && results.channel.location !== 'undefined' && results.channel.item !== 'undefined') {
            let weather = results.channel
            bot.say(to, `The current weather in ${weather.location.city}, ${weather.location.country} is ${weather.item.condition.temp}${weather.units.temperature} and ${weather.item.condition.text}`)
          } else {
            bot.say(to, `Oops, couldn't get weather data for ${cityname}`)
          }
        }
      })
      return
    }
  })

  return {
    name: 'Weather',
    actions: [{
      command: '!weather <place>',
      helptext: 'Returns the current weather at <place>'
    }]
  }
}
