#!/usr/bin/env sh
# Deskmate installer: checks Docker, starts Deskmate, and prints your setup link.
set -e

say() { printf '\n  %s\n' "$1"; }

if ! command -v docker >/dev/null 2>&1; then
  say "Docker is not installed. Install Docker Desktop (Mac/Windows) or Docker Engine (Linux) from https://docs.docker.com/get-docker/ and run this again."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  sed -i.bak "s/^APP_SECRET=.*/APP_SECRET=$SECRET/" .env && rm -f .env.bak
  say "Created .env with a fresh encryption key. Keep this file safe and include it in backups."
fi

say "Starting Deskmate (the first time takes a few minutes)..."
docker compose up -d --build

URL=$(grep -E '^PUBLIC_URL=' .env | cut -d= -f2-)
URL=${URL:-http://localhost:3000}
for i in $(seq 1 60); do
  if docker compose exec -T deskmate wget -qO- http://localhost:3000/healthz >/dev/null 2>&1; then break; fi
  sleep 2
done

CODE=$(docker compose exec -T deskmate cat /data/setup-code.txt 2>/dev/null | tr -d '\r\n' || true)
if [ -n "$CODE" ]; then
  say "Deskmate is running. Open this link to set it up:"
  say "    $URL/setup?code=$CODE"
else
  say "Deskmate is running at $URL"
fi
echo
