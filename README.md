# Alice

A simple Node.js IRC bot.

## Running

Requires Node.js 22+ and Redis.

```sh
yarn install
BOT_SERVER=irc.libera.chat BOT_TLS=true BOT_ADMINS='me!*@user/me' yarn start
```

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
| `BOT_ADMINS` | | Comma-separated hostmasks allowed to use `@` commands, i.e. `me!*@user/me` |
| `BOT_ADMIN_ACCOUNTS` | | Comma-separated services accounts allowed to use `@` commands (needs IRCv3 `account-tag`) |
| `REDIS_URL` | `redis://localhost:6379` | |
| `DEFAULT_TOPIC` | `Imagination is the only weapon in the war against reality` | Topic set when the bot is alone in a channel |
| `DEFAULT_DISCONNECT` | `We're all mad here.` | Quit message for `@disconnect` |

If neither `BOT_ADMINS` nor `BOT_ADMIN_ACCOUNTS` is set, admin commands are disabled. Prefer
cloaked hosts (`*!*@user/me`) or services accounts: a plain hostname is easy to spoof.

## Commands

`!help` (in a channel) and `@help` (in a private message) list commands.

Public: `!alice`, `!time <place>`, `!weather <place>`, `!remember <word> <phrase>`, `!forget <word>`, `!memory`.

Admin, by private message: `@join`, `@part`, `@op`, `@say`, `@nick`, `@opadd <nick> <hostmask>`,
`@opremove <nick>`, `@oplist`.

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
for admins. Plugins can also listen to any [irc-framework](https://github.com/kiwiirc/irc-framework)
event with `bot.on(...)`. Add the plugin to the list in `bot.js` to load it.
