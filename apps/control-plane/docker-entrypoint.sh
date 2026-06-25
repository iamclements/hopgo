#!/bin/sh
set -e

# Remap to the host user's ids so anything written to a mounted volume stays
# owned by that user, then drop root and exec the app. su-exec accepts numeric
# uid:gid directly, so no named user is needed.
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

if [ "$(id -u)" = "0" ]; then
  chown -R "${PUID}:${PGID}" /app
  exec su-exec "${PUID}:${PGID}" "$@"
fi

exec "$@"
