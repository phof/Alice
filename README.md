# Alice

A simple Node.js IRC bot.

## Running

Requires Node.js 22+ and Redis.

```sh
yarn install
BOT_SERVER=open.ircnet.net BOT_CHANNELS='#mychannel' yarn start
```

Then claim the bot, see [Owner and admins](#owner-and-admins).

`yarn dev` restarts the bot on file changes, `yarn test` runs the tests and `yarn lint` checks style.

## Configuration

All settings come from environment variables.

| Variable | Default | |
| --- | --- | --- |
| `BOT_SERVER` | `localhost` | IRC server |
| `BOT_PORT` | `6697` with TLS, else `6667` | |
| `BOT_TLS` | `false` | Connect over TLS |
| `BOT_PASSWORD` | | Server password |
| `BOT_SASL_ACCOUNT`, `BOT_SASL_PASSWORD` | | Log in to services with SASL |
| `BOT_NICK` | `Alice` | |
| `BOT_USERNAME` | `alice` | |
| `BOT_REALNAME` | `What is a Caucus-race?` | |
| `BOT_CHANNELS` | `#wonderland` | Comma-separated |
| `BOT_ADMINS` | | Optional extra comma-separated hostmasks allowed to use `@` commands |
| `BOT_RECLAIM` | `false` | Print a new claim code at startup even if the bot has an owner |
| `REDIS_URL` | `redis://localhost:6379` | |
| `DEFAULT_TOPIC` | `Imagination is the only weapon in the war against reality` | Topic set when the bot is alone in a channel |
| `DEFAULT_DISCONNECT` | `We're all mad here.` | Quit message for `@disconnect` |

## Owner and admins

The first time the bot starts, it prints a one-time code to its logs:

```
CLAIM | To become the bot owner, message it: /msg Alice @claim RCVFr3LwE4JVaavk
```

Send that message and you become the owner, matched by your current `*!ident@host`. The code
then stops working. The owner can't be removed from IRC, and from there you can add admins:

- `@adminadd <nick>` adds an online user by their current host (looked up with WHOIS), or
  `@adminadd <nick!user@host>` adds a mask with `*` and `?` wildcards.
- `@admindel <mask>` and `@adminlist` remove and list admins.
- `@owner <mask>` lets the owner change their own mask, i.e. `@owner *!~me@*.myisp.net`
  if your IP changes often. Be careful: a mask that is too broad lets others in.

Locked out, e.g. after an IP change? Restart the bot with `BOT_RECLAIM=true` to get a new code,
then claim again and remove the variable.

## Commands

`!help` (in a channel) and `@help` (in a private message) list commands.

Public: `!alice`, `!time <place>`, `!weather <place>`, `!remember <word> <phrase>`, `!forget <word>`, `!memory`.

Admin, by private message: `@join`, `@part`, `@op`, `@say`, `@nick`, `@opadd <nick> <hostmask>`,
`@opremove <nick>`, `@oplist`, `@adminadd`, `@admindel`, `@adminlist`, `@owner`.

Time and weather data come from [Open-Meteo](https://open-meteo.com/), no API key needed.

## Plugins

A plugin is a function that receives `{ bot, db, config }` and returns its name and commands:

```js
export default function ({ bot }) {
  return {
    name: 'Hello',
    commands: [{
      command: '!hello',
      usage: '!hello [name]',
      helptext: 'Says hello',
      handler: ({ nick, args, reply }) => reply(`Hello ${args || nick}!`)
    }]
  }
}
```

Commands starting with `!` work in channels; commands starting with `@` work in private messages and only
for admins (unless the command sets `access: 'anyone'`, like `@claim`). Plugins can also listen to any [irc-framework](https://github.com/kiwiirc/irc-framework)
event with `bot.on(...)`. Add the plugin to the list in `bot.js` to load it.
