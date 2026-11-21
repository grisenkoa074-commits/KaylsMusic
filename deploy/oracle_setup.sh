#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/kaylsmusic"
SERVICE_NAME="kaylsmusic"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash deploy/oracle_setup.sh"
  exit 1
fi

if [[ ! -f "${SCRIPT_DIR}/bot.py" || ! -f "${SCRIPT_DIR}/requirements.txt" ]]; then
  echo "Run this script from a KaylsMusic repository checkout."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y python3 python3-venv python3-pip git

if ! id "${SERVICE_NAME}" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${SERVICE_NAME}"
fi

install -d -o "${SERVICE_NAME}" -g "${SERVICE_NAME}" "${APP_DIR}"
cp -a "${SCRIPT_DIR}/." "${APP_DIR}/"
chown -R "${SERVICE_NAME}:${SERVICE_NAME}" "${APP_DIR}"

if [[ ! -f "${APP_DIR}/.env" ]]; then
  install -o "${SERVICE_NAME}" -g "${SERVICE_NAME}" -m 600 "${APP_DIR}/.env.example" "${APP_DIR}/.env"
  echo
  echo "Created ${APP_DIR}/.env from .env.example."
  echo "Edit it and set TELEGRAM_BOT_TOKEN before starting the service."
fi

sudo -u "${SERVICE_NAME}" python3 -m venv "${APP_DIR}/.venv"
sudo -u "${SERVICE_NAME}" "${APP_DIR}/.venv/bin/pip" install --upgrade pip
sudo -u "${SERVICE_NAME}" "${APP_DIR}/.venv/bin/pip" install -r "${APP_DIR}/requirements.txt"

install -m 644 "${APP_DIR}/deploy/kaylsmusic.service" "/etc/systemd/system/kaylsmusic.service"
systemctl daemon-reload
systemctl enable kaylsmusic.service

echo
echo "Installation prepared. Add your Telegram token to ${APP_DIR}/.env, then run:"
echo "  sudo nano ${APP_DIR}/.env"
echo "  sudo systemctl start kaylsmusic"
echo "  sudo systemctl status kaylsmusic"
