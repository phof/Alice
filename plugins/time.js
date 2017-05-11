'use strict'

const Yql = require('yql')
const moment = require('moment-timezone')

module.exports = (bot) => {
  const re = /(!time) (.+$)/i
  const query = 'select name,country,timezone from geo.places(1) where text=@city'

  bot.on('message#', (nick, to, text) => {
    let match = text.match(re)

    if (match) {
      let cityname = match[2]
      Yql(query).setParam('city', cityname).exec((err, response) => {
        if (err) {
          console.error(`Error while trying to retrieve datetime data for ${cityname}`, err)
          bot.say(to, `Ugh, error while trying to retrieve datetime data for ${cityname}`)
        } else {
          let results = response.query.results
          if (results !== null && typeof results.place !== 'undefined') {
            let datetime = moment().tz(results.place.timezone.content).format('dddd, MMMM Do YYYY, HH:mm:ss')
            bot.say(to, `The datetime in ${results.place.name}, ${results.place.country.content} is ${datetime}`)
          } else {
            bot.say(to, `Oops, couldn't get datetime data for ${cityname}`)
          }
        }
      })
    }
  })

  return {
    name: 'Time',
    actions: [{
      command: '!time <place>',
      helptext: 'Returns the current datetime at <place>'
    }]
  }
}
