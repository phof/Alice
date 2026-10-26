#!/usr/bin/env bash
# License: MIT
# Source: https://github.com/phof/Alice

source /dev/stdin <<<"$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

ALICE_REPO="${ALICE_REPO:-phof/Alice}"
ALICE_BRANCH="${ALICE_BRANCH:-master}"

msg_info "Installing Dependencies"
$STD apt install -y git redis-server
msg_ok "Installed Dependencies"

msg_info "Configuring Redis"
# Local only (Debian's default bind), with an append-only file so reminders,
# memories and admins survive crashes and restarts
sed -i 's/^appendonly no/appendonly yes/' /etc/redis/redis.conf
systemctl enable -q redis-server
systemctl restart redis-server
msg_ok "Configured Redis"

NODE_VERSION="24" NODE_MODULE="yarn" setup_nodejs

msg_info "Installing Alice"
$STD git clone --branch "$ALICE_BRANCH" "https://github.com/${ALICE_REPO}.git" /opt/alice
cd /opt/alice || exit
$STD yarn install --production --frozen-lockfile
useradd --system --no-create-home --shell /usr/sbin/nologin alice
msg_ok "Installed Alice ($(git rev-parse --short HEAD))"

# Ask for the basics; everything else has defaults (see README)
ask() {
  local prompt="$1" default="$2" answer=""
  if [[ -t 0 ]]; then
    read -r -p "${TAB3}${prompt} [${default}]: " answer
  fi
  echo "${answer:-$default}"
}
if [[ -t 0 ]]; then
  echo -e "${TAB3}IRCnet servers open to everyone: https://www.ircnet.info/servers?open=true"
fi
BOT_SERVER="$(ask "IRC server" "hostsailor.ircnet.nl")"
BOT_TLS="$(ask "Use TLS (true/false)" "false")"
BOT_NICK="$(ask "Bot nickname" "Alice")"
BOT_CHANNELS="$(ask "Channels, comma-separated" "#wonderland")"

msg_info "Writing Configuration"
mkdir -p /etc/alice
cat <<CONF >/etc/alice/alice.env
# Alice settings, see https://github.com/${ALICE_REPO}#configuration
# Apply changes with: systemctl restart alice
# IRCnet servers open to everyone: https://www.ircnet.info/servers?open=true
BOT_SERVER=${BOT_SERVER}
BOT_TLS=${BOT_TLS}
BOT_NICK=${BOT_NICK}
BOT_CHANNELS=${BOT_CHANNELS}
REDIS_URL=redis://127.0.0.1:6379
#BOT_PORT=
#BOT_USERNAME=alice
#BOT_REALNAME=What is a Caucus-race?
#BOT_ADMINS=
#FLOOD_PROTECTION=true
#MEMORY_COOLDOWN=30
#BOT_RECLAIM=false
CONF
chown root:alice /etc/alice/alice.env
chmod 640 /etc/alice/alice.env
msg_ok "Wrote /etc/alice/alice.env"

msg_info "Creating Service"
cat <<EOF2 >/etc/systemd/system/alice.service
[Unit]
Description=Alice IRC bot
After=network-online.target redis-server.service
Wants=network-online.target redis-server.service

[Service]
Type=simple
User=alice
Group=alice
WorkingDirectory=/opt/alice
EnvironmentFile=/etc/alice/alice.env
ExecStart=/usr/bin/node bot.js
Restart=always
RestartSec=10
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF2
systemctl enable -q --now alice
msg_ok "Created Service"

# The bot prints a one-time claim code on first start; show it here
msg_info "Waiting for the claim code"
CLAIM=""
for _ in $(seq 1 30); do
  CLAIM="$(journalctl -u alice --no-pager -o cat 2>/dev/null | grep -o '/msg .* @claim [A-Za-z0-9_-]*' | tail -n1)" || true
  [[ -n "$CLAIM" ]] && break
  sleep 1
done
if [[ -n "$CLAIM" ]]; then
  msg_ok "To become the bot owner, send on IRC: ${CLAIM}"
else
  msg_warn "No claim code yet, check: journalctl -u alice | grep CLAIM"
fi

motd_ssh
customize
cleanup_lxc
