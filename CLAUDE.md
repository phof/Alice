# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Alice is an IRC bot (aimed at IRCnet) built on [irc-framework](https://github.com/kiwiirc/irc-framework) with Redis for storage. Node 24+, ES modules, pnpm (version pinned via `packageManager`; run `corepack enable`).

## Commands

```sh
pnpm install
BOT_SERVER=... BOT_CHANNELS='#chan' pnpm start   # pnpm dev restarts on file changes
pnpm test                                        # node --test
pnpm lint                                        # eslint with neostandard (no semicolons, space before parens)
node --test test/plugins.test.js                 # one file
node --test --test-name-pattern='keep-op'        # tests matching a name
```

`test/redis.test.js` runs plugins against a real Redis at `TEST_REDIS_URL` (default `redis://127.0.0.1:6379/15`), which it **flushes** before every test; those tests are skipped when Redis is unreachable. CI (`.github/workflows/ci.yml`) runs lint and tests with a Redis 8 service.

All configuration comes from environment variables, parsed in `lib/config.js` and documented in the README's Configuration table. Keep both in sync when adding a setting.

## Architecture

- **`bot.js`** wires everything: creates the irc-framework `Client`, Redis client and admins store, wraps the client with `throttle`, calls each plugin factory with `{ bot, db, config, admins, shutdown }`, then hands the plugins to `createRouter`. A new plugin must be added to the list there. Exit code 0 means "stopped on purpose" (systemd leaves it stopped); anything else makes systemd restart it.
- **Plugins** (`plugins/*.js`) are factories returning `{ name, commands }`. They can also subscribe to any irc-framework event via `bot.on(...)` (e.g. `keep_op`, `greet`, `flood` are mostly event-driven).
- **`lib/commands.js`** (router): `!cmd` works only in channels, `@cmd` only in private messages and only for admins unless the command sets `access: 'anyone'`. Handlers get `{ nick, target, args, argv, event, reply }`. It also provides `!help`/`@help` from each command's `usage`/`helptext`, applies the per-`user@host` rate limit (admins exempt for `@` commands) and catches handler errors.
- **`lib/throttle.js`** monkey-patches `bot.say`/`bot.notice` into a queue obeying ircd flood limits (burst 4, then 1 line / 2s, max 50 queued). Pass `{ important: true }` for lines that must not be dropped (reminders, `!tell`). `bot.raw` and `bot.sayNow` bypass the queue but still consume the allowance, so moderation (KICK/MODE/ban) is immediate.
- **`lib/admins.js`**: three sources of admin rights: the owner (set via a one-time `@claim` code printed at startup, key `admin:owner`), admins in the Redis set `admins`, and `BOT_ADMINS` hostmasks. Masks are IRC globs matched against `nick!ident@host` (`lib/mask.js`).
- **`db/redis.js`**: the client uses `disableOfflineQueue`, so commands fail fast while Redis is down; code reading Redis should tolerate errors. Keys are namespaced per plugin (`user:`, `memory:`, `seen:`, `tell:`, `greet:`, ...).
- **IRC casemapping**: nicks and channels in keys and maps go through `bot.caseLower()` (rfc1459: `[]\` are uppercase of `{}|`), never `toLowerCase()`. Plugins that changed key casing ship a `migrate()` run on Redis `ready`.

## Tests

Tests use `node:test` with `test/helpers.js`: `fakeBot()` is an EventEmitter stand-in for the irc-framework client that records outgoing lines in `bot.sent` (e.g. `['raw', 'MODE', '#c', '+sn']`, `['say', target, text]`). Emit irc-framework events on it and assert on `bot.sent`. Pure-logic and fake-Redis tests live in `test/plugins.test.js`; anything needing real Redis semantics goes in `test/redis.test.js`.

## Deployment

`proxmox/` holds a community-scripts.org style installer (`ct/alice.sh` on the host, `install/alice-install.sh` in the container). It fetches from `phof/Alice` on `master` (override with `ALICE_REPO`/`ALICE_BRANCH`), so changes there only take effect once pushed. In the container: settings in `/etc/alice/alice.env`, service `alice`, code in `/opt/alice`.
