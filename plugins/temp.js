'use strict'

var request = require('request')

module.exports = function (bot) {
  const re = /!temp/i
  const url = process.env.PEK_URL + ':20060/temp'
  const fp_res = "The temperature at Pekyntosh's home is " // first part response
  const sp_res = 'C' // second part response
  const error_res = "I'm sorry but the sensor is not available"

  bot.on('message#', (nick, to, text) => {
    if (text.match(re)) {
      request(url, function (error, response, body) {
        if (!error && response.statusCode === 200) {
          bot.say(to, fp_res + body + sp_res)
        } else {
          bot.say(to, error_res)
        }
      })
    }
  })

  return {
    name: 'IOT home temperature',
    actions: [{
      command: '!temp',
      helptext: 'Internet Of Things: returns Pekyntosh\'s home temperature provided by ESP8266 device with DS18b20 sensor (work in progress)'
    }]
  }
}
