#!/usr/bin/env bash
# Install or update the repeater directory backend on the droplet.
#   bash install.sh [git-ref]      (default: main)
# Safe to re-run: keeps pb_data and pocketbase.env, only adds the compose
# service and Caddy block once, and archives the files it changes.
set -euo pipefail
REF="${1:-main}"
STACK=/root/acadiana-stack
TS=$(date +%Y%m%d-%H%M)
ARCH=/root/archive/pocketbase-$TS
mkdir -p "$ARCH"
cp "$STACK/docker-compose.yml" "$STACK/caddy-config/Caddyfile" "$ARCH/"

TMP=$(mktemp -d)
curl -fsSL "https://codeload.github.com/RobbieBott/Acadiana-mesh-site/tar.gz/$REF" | tar xz -C "$TMP"
SRC=$(echo "$TMP"/*/infra/pocketbase)
mkdir -p "$STACK/pocketbase/pb_data"
rm -rf "$STACK/pocketbase/pb_migrations"
cp -r "$SRC/Dockerfile" "$SRC/pb_migrations" "$SRC/README.md" "$SRC/compose-service.yml" "$SRC/Caddyfile-block" "$SRC/install.sh" "$STACK/pocketbase/"
rm -rf "$TMP"

if [ ! -f "$STACK/pocketbase.env" ]; then
  ( umask 077; echo "PB_ENCRYPTION_KEY=$(openssl rand -hex 16)" > "$STACK/pocketbase.env" )
  echo "[pb] created pocketbase.env (encryption key)"
fi

if ! grep -q '^  pocketbase:' "$STACK/docker-compose.yml"; then
  python3 - "$STACK/docker-compose.yml" "$STACK/pocketbase/compose-service.yml" <<'PY'
import sys
path, block = sys.argv[1], open(sys.argv[2]).read()
block = ''.join(l for l in block.splitlines(True) if not l.startswith('#'))
s = open(path).read()
i = s.index('\nnetworks:\n')
open(path, 'w').write(s[:i + 1] + block + s[i + 1:])
PY
  echo "[pb] added compose service"
fi

# Caddy: one block for repeaters.acadianamesh.com (replaces the old data.acadianamesh.com block).
# The Caddyfile is a single-file bind mount, so it is rewritten in place.
python3 - "$STACK/caddy-config/Caddyfile" "$STACK/pocketbase/Caddyfile-block" <<'PY'
import re, sys
path, block = sys.argv[1], open(sys.argv[2]).read().strip() + "\n"
s = open(path).read()
new = re.sub(r"\n*^(data|repeaters)\.acadianamesh\.com \{\n.*?^\}\n?", "\n", s, flags=re.M | re.S)
new = new.rstrip("\n") + "\n\n" + block
if new != s:
    with open(path, "r+") as f:
        f.seek(0); f.write(new); f.truncate()
    print("[pb] Caddy block written")
PY

cd "$STACK"
docker compose config -q
docker compose build pocketbase
docker compose up -d pocketbase
docker exec corescope-prod caddy reload --config /etc/caddy/Caddyfile
sleep 4
docker ps --filter name=pocketbase --format '{{.Names}} {{.Status}}'
echo "[pb] done (archive: $ARCH)"
