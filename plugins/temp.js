export default function () {
  const url = `${process.env.PEK_URL}:20060/temp`

  return {
    name: 'IOT home temperature',
    commands: [{
      command: '!temp',
      helptext: "Internet Of Things: returns Pekyntosh's home temperature provided by ESP8266 device with DS18b20 sensor (work in progress)",
      handler: async ({ reply }) => {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          reply(`The temperature at Pekyntosh's home is ${(await res.text()).trim()}C`)
        } catch {
          reply("I'm sorry but the sensor is not available")
        }
      }
    }]
  }
}
