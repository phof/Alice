#!/usr/bin/env bash
# Alice IRC bot: creates a Debian LXC on Proxmox VE using the community-scripts.org framework.
# Run on the Proxmox host:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/phof/Alice/master/proxmox/ct/alice.sh)"
# Run "update" inside the container (or this script again, from the container's console) to update.

# Our install script lives in this repo, not in community-scripts/ProxmoxVE
export ALICE_REPO="${ALICE_REPO:-phof/Alice}"
export ALICE_BRANCH="${ALICE_BRANCH:-master}"
export COMMUNITY_SCRIPTS_URL="${COMMUNITY_SCRIPTS_URL:-https://raw.githubusercontent.com/${ALICE_REPO}/${ALICE_BRANCH}/proxmox}"

_cs_boot="${COMMUNITY_SCRIPTS_CORE_DIR:-$(dirname "${BASH_SOURCE[0]}")/../../core}/core/build.func"
source "$_cs_boot" 2>/dev/null || source <(curl -fsSL "${COMMUNITY_SCRIPTS_CORE_URL:-https://raw.githubusercontent.com/community-scripts/core/main}/core/build.func")
# License: MIT
# Source: https://github.com/phof/Alice

APP="Alice"
var_tags="${var_tags:-irc;bot}"
var_cpu="${var_cpu:-1}"
var_ram="${var_ram:-512}"
var_disk="${var_disk:-4}"
var_os="${var_os:-debian}"
var_version="${var_version:-13}"
var_unprivileged="${var_unprivileged:-1}"

header_info "$APP"
variables
color
catch_errors

function update_script() {
  header_info
  check_container_storage
  check_container_resources
  if [[ ! -d /opt/alice/.git ]]; then
    msg_error "No ${APP} Installation Found!"
    exit
  fi

  cd /opt/alice || exit
  $STD git fetch --quiet origin
  if [[ "$(git rev-parse HEAD)" == "$(git rev-parse '@{u}')" ]]; then
    msg_ok "${APP} is already up to date ($(git rev-parse --short HEAD))"
    exit
  fi

  msg_info "Stopping Service"
  systemctl stop alice
  msg_ok "Stopped Service"

  msg_info "Updating ${APP}"
  $STD git reset --hard '@{u}'
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  $STD pnpm install --prod --frozen-lockfile
  msg_ok "Updated ${APP} to $(git rev-parse --short HEAD)"

  msg_info "Starting Service"
  systemctl start alice
  msg_ok "Started Service"
  msg_ok "Updated successfully!"
  exit
}

start
build_container
description

msg_ok "Completed successfully!\n"
echo -e "${CREATING}${GN}${APP} setup has been successfully initialized!${CL}"
echo -e "${INFO}${YW}Settings: /etc/alice/alice.env, then: systemctl restart alice${CL}"
echo -e "${INFO}${YW}Logs and the claim code: journalctl -u alice -f${CL}"
