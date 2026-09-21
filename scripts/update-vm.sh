#!/usr/bin/env bash

set -Eeuo pipefail

readonly APP_IMAGE="rover-rally-app"
readonly APP_CONTAINER="rover-rally-app"
readonly PROXY_CONTAINER="rover-rally-proxy"
readonly NETWORK_NAME="rover-rally"
readonly DATA_VOLUME="rover-rally-data"
readonly BACKUP_DIR="/var/backups/rover-rally"
readonly CADDY_DIR="/etc/rover-rally"
readonly CADDY_IMAGE="caddy:2-alpine"
readonly LOCAL_PORT="8788"

PUBLIC_ORIGIN=""
TARGET=""
STANDALONE=false

die() {
  printf 'Ошибка: %s\n' "$*" >&2
  exit 1
}

is_ipv4() {
  local octet parts=()
  [[ "$1" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || return 1
  IFS=. read -r -a parts <<<"$1"
  for octet in "${parts[@]}"; do
    ((10#$octet <= 255)) || return 1
  done
}

configure_target() {
  TARGET="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  if is_ipv4 "$TARGET"; then
    PUBLIC_ORIGIN="http://${TARGET}"
    return
  fi
  [[ ! "$TARGET" =~ ^[0-9.]+$ ]] || die "Некорректный IPv4-адрес"
  [[ ${#TARGET} -le 253 ]] || die "Слишком длинное имя домена"
  [[ "$TARGET" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$ ]] ||
    die "Передай домен без схемы и пути или IPv4-адрес"
  PUBLIC_ORIGIN="https://${TARGET}"
}

check_requirements() {
  ((EUID == 0)) || die "Запусти скрипт от root"
  command -v docker >/dev/null || die "Установи Docker"
  command -v curl >/dev/null || die "Установи curl"
  docker info >/dev/null 2>&1 || die "Нет подключения к Docker daemon"
  [[ -f app/Dockerfile ]] || die "Запусти скрипт из корня репозитория"
}

ensure_storage() {
  docker network inspect "$NETWORK_NAME" >/dev/null 2>&1 ||
    docker network create "$NETWORK_NAME" >/dev/null
  docker volume inspect "$DATA_VOLUME" >/dev/null 2>&1 ||
    docker volume create "$DATA_VOLUME" >/dev/null
  mkdir -p "$BACKUP_DIR"
  chmod 0700 "$BACKUP_DIR"
}

prepare_proxy() {
  [[ "$STANDALONE" == true ]] || return 0
  mkdir -p "$CADDY_DIR"
  printf '%s\n' "${PUBLIC_ORIGIN} {" "    reverse_proxy ${APP_CONTAINER}:8787" "}" >"${CADDY_DIR}/Caddyfile.next"
  chmod 0644 "${CADDY_DIR}/Caddyfile.next"
  docker pull "$CADDY_IMAGE"
  docker run --rm --network none \
    -v "${CADDY_DIR}/Caddyfile.next:/etc/caddy/Caddyfile:ro" \
    "$CADDY_IMAGE" caddy validate --config /etc/caddy/Caddyfile
}

backup_database() {
  local filename="game-$(date -u +%Y%m%dT%H%M%SZ)-$$.sqlite"
  printf '\nСохраняю базу перед обновлением\n'
  docker run --rm --user 0 --network none \
    -v "${DATA_VOLUME}:/data" -v "${BACKUP_DIR}:/backup" \
    "$APP_IMAGE" sh -ec \
    'if [ -e "$1" ]; then node server/backup.ts "$1" "$2"; else printf "Базы ещё нет, первый запуск.\n"; fi' \
    sh /data/rover.sqlite "/backup/${filename}"
  [[ ! -f "${BACKUP_DIR}/${filename}" ]] || chmod 0600 "${BACKUP_DIR}/${filename}"
}

remove_container() {
  docker container inspect "$1" >/dev/null 2>&1 || return 0
  docker rm -f "$1" >/dev/null
}

start_app() {
  remove_container "$APP_CONTAINER"
  docker run -d --init --name "$APP_CONTAINER" --restart unless-stopped \
    --network "$NETWORK_NAME" -p "127.0.0.1:${LOCAL_PORT}:8787" \
    -e PORT=8787 -e HOST=0.0.0.0 -e DB_PATH=/data/rover.sqlite \
    -v "${DATA_VOLUME}:/data" "$APP_IMAGE" >/dev/null
}

start_proxy() {
  [[ "$STANDALONE" == true ]] || return 0
  remove_container "$PROXY_CONTAINER"
  mv "${CADDY_DIR}/Caddyfile.next" "${CADDY_DIR}/Caddyfile"
  docker run -d --init --name "$PROXY_CONTAINER" --restart unless-stopped \
    --network "$NETWORK_NAME" -p 80:80 -p 443:443 \
    -v "${CADDY_DIR}/Caddyfile:/etc/caddy/Caddyfile:ro" \
    -v rover-rally-caddy-data:/data -v rover-rally-caddy-config:/config \
    "$CADDY_IMAGE" >/dev/null
}

check_health() {
  local attempt
  for ((attempt = 1; attempt <= 30; attempt++)); do
    if curl --fail --silent --show-error --connect-timeout 2 --max-time 3 \
      "http://127.0.0.1:${LOCAL_PORT}/health"; then
      return 0
    fi
    sleep 1
  done
  die "Приложение не ответило. Проверь docker logs ${APP_CONTAINER}"
}

print_result() {
  printf '\nПриложение работает: http://127.0.0.1:%s\n' "$LOCAL_PORT"
  if [[ "$STANDALONE" == true ]]; then
    printf 'Caddy запущен для %s. Проверь: curl -fsS %s/health\n' "$PUBLIC_ORIGIN" "$PUBLIC_ORIGIN"
  else
    printf 'Добавь %s в свой reverse proxy. Инструкция: docs/deploy-single-vm.md\n' "$PUBLIC_ORIGIN"
  fi
}

main() {
  (($# >= 1 && $# <= 2)) || die "Использование: ./scripts/update-vm.sh <домен или IPv4> [--standalone]"
  if (($# == 2)); then
    [[ "$2" == --standalone ]] || die "Неизвестный аргумент: $2"
    STANDALONE=true
  fi
  configure_target "$1"
  check_requirements
  printf '\nСобираю приложение\n'
  docker build -f app/Dockerfile -t "$APP_IMAGE" app
  ensure_storage
  prepare_proxy
  backup_database
  start_app
  check_health
  start_proxy
  print_result
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
