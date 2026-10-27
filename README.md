# Alice

A simple Node.js IRC bot.

## Running

Requires Node.js 24+ and Redis (8 recommended). Dependencies are managed with pnpm; `corepack enable`
gets the exact pnpm version this project pins.

```sh
corepack enable
pnpm install
BOT_SERVER=hostsailor.ircnet.nl BOT_CHANNELS='#mychannel' pnpm start
```

Then claim the bot, see [Owner and admins](#owner-and-admins). On IRCnet, not every server accepts
connections from everywhere: see the [list of open servers](https://www.ircnet.info/servers?open=true).

`pnpm dev` restarts the bot on file changes, `pnpm test` runs the tests and `pnpm lint` checks style.
Some tests need Redis: they use `TEST_REDIS_URL` (default `redis://127.0.0.1:6379/15`, **flushed** by
the tests) and are skipped if it isn't reachable.

## Proxmox LXC

`proxmox/` holds a [community-scripts.org](https://community-scripts.org/) style installer. On the
Proxmox host, run:

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/phof/Alice/master/proxmox/ct/alice.sh)"
```

It creates an unprivileged Debian 13 container (1 CPU, 512 MB RAM, 4 GB disk) with Node.js 24 and a
local Redis 8 (from the official Redis repository), asks for the server (default `hostsailor.ircnet.nl`, see the
[open IRCnet servers](https://www.ircnet.info/servers?open=true)), nick and channels, and starts the bot as a systemd service. At the
end it shows the `@claim` code. To install from another branch or fork, set `ALICE_BRANCH` and/or
`ALICE_REPO` before the command, e.g. `ALICE_BRANCH=my-branch bash -c "$(curl ...)"` (the URL must
point at the same branch).

In the container:

- Settings: `/etc/alice/alice.env`, then `systemctl restart alice`
- Logs: `journalctl -u alice -f`
- Update: run `update`
- Code is in `/opt/alice`; Redis data in `/var/lib/redis` (append-only file enabled)

## Configuration

All settings come from environment variables.

| Variable | Default | |
| --- | --- | --- |
| `BOT_SERVER` | `hostsailor.ircnet.nl` | IRC server, see the [open IRCnet servers](https://www.ircnet.info/servers?open=true) |
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
| `RATE_LIMIT_BURST`, `RATE_LIMIT_INTERVAL` | `5`, `6` | Commands per user: a burst of 5, then one every 6 seconds |
| `FLOOD_PROTECTION` | `true` | Set to `false` to turn channel flood protection off |
| `FLOOD_LINES`, `FLOOD_SECONDS` | `8`, `6` | More than 8 messages in 6 seconds is flooding |
| `FLOOD_REPEATS` | `4` | The same message 4 times in a minute is spam |
| `FLOOD_BAN_MINUTES` | `15` | How long flood bans last |
| `GREET` | `true` | Set to `false` to stop greeting people who join |
| `GREET_AFTER_DAYS` | `3` | Greet people again when they come back after this many days away |
| `MEMORY_COOLDOWN` | `2` | Minimum seconds between two memory replies in a channel |
| `DEFAULT_TOPIC` | `Imagination is the only weapon in the war against reality` | Topic set when the bot rejoins an empty channel to regain op |
| `DEFAULT_DISCONNECT` | `We're all mad here.` | Quit message for `@disconnect` |

## Owner and admins

The first time the bot starts, it prints a one-time code to its logs:

```
CLAIM | To become the bot owner, message it: /msg Alice @claim RCVFr3LwE4JVaavk
```

Send that message and you become the owner, matched by your current `*!ident@host`. The code
then stops working. The owner can't be removed from IRC, and the owner and admins are opped
automatically when they join a channel (if the bot has op). From there you can add admins:

- `@adminadd <nick>` adds an online user by their current host (looked up with WHOIS), or
  `@adminadd <nick!user@host>` adds a mask with `*` and `?` wildcards.
- `@admindel <mask>` and `@adminlist` remove and list admins.
- `@owner <mask>` lets the owner change their own mask, i.e. `@owner *!~me@*.myisp.net`
  if your IP changes often. Be careful: a mask that is too broad lets others in.

Locked out, e.g. after an IP change? Restart the bot with `BOT_RECLAIM=true` to get a new code,
then claim again and remove the variable.

## Greetings

When someone joins a channel for the first time the bot has seen them there, it greets them in the
channel with a random line, e.g. "bob fell down the rabbit hole and landed in #wonderland. Welcome!".
When they come back after 3 or more days away it welcomes them back ("Welcome back, bob! It's been
4d 2h."). Being in the channel, talking or leaving all count as being seen, so rejoins after a
netsplit aren't greeted. At most 3 greetings go out per channel at a time, then one every 20 seconds,
so a join flood can't make the bot flood. The lines are in `plugins/greet.js`.

## Rate limiting and flood protection

- **Commands** are rate limited per `user@host`, so changing nick doesn't help. The first time someone
  hits the limit they get a notice; after that their commands are ignored until the limit refills.
  Admins aren't limited for `@` commands.
- **Channels**: flooding or repeating the same message is an offence. The first offence gets a warning,
  the second a kick, the third a ban on `*!*@host` for 15 minutes. There's a 10 second grace period
  after each step, and offences are forgotten after 10 minutes of good behaviour. Admins are exempt.
  Ban expiry is stored in Redis, so bans are still lifted after a restart.
  **Kicks and bans only work if the bot is a channel operator.**
- **Outgoing**: the bot follows the standard ircd flood limits for clients
  ([RFC 1459 §8.10](https://www.rfc-editor.org/rfc/rfc1459#section-8.10)), which IRCnet uses: a burst
  of 4 lines, then one line every 2 seconds, so the server never disconnects it for "Excess Flood". Replies wait in a queue, which drops
  new lines once 50 are waiting (reminders and `!tell` deliveries are never dropped). Kicks, bans and
  other commands go out immediately.

## Commands

`!help` (in a channel) and `@help` (in a private message) list the commands in one line.
`!help <command>` or `@help <command>` explains one, e.g. `!help remind`.

Public:

| Command | |
| --- | --- |
| `!alice` | A random Alice in Wonderland quote |
| `!time <place>`, `!weather <place>` | Current time or weather |
| `!seen <nick>` | When `<nick>` was last seen in a channel, and what they said |
| `!tell <nick> <message>` | Passes `<message>` on the next time `<nick>` speaks |
| `!remind <in 2h\|1h30m\|10 minutes> <message>` | Reminds you in the channel; survives restarts |
| `!remember <word> <phrase>` | When someone mentions `<word>`, reply with `<phrase>` (or one of several). `$nick` and `$channel` are filled in |
| `!memory [word]` | Lists known words, or the numbered phrases for `[word]` |
| `!forget <word> [number]` | Forgets a word, or just one of its phrases |

Admin, by private message: `@join`, `@part`, `@op`, `@say`, `@nick`, `@disconnect`, `@opadd <nick> <hostmask>`,
`@opremove <nick>`, `@oplist`, `@adminadd`, `@admindel`, `@adminlist`, `@owner`, and for the owner only
`@flushdb confirm`, which deletes all bot data except the owner.

`@disconnect` stops the bot. In the LXC it stays stopped until `systemctl start alice` or a reboot;
crashes and connection failures are still restarted automatically.

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
