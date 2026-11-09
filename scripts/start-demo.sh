#!/usr/bin/env bash
# Starts everything Bato needs on this laptop: PostgreSQL, Redis, the API, the admin panel and Metro
# (the mobile app's bundler). Usage:
#
#   ./scripts/start-demo.sh            # start everything
#   ./scripts/start-demo.sh --seed     # also re-load data/ first (overwrites admin edits to seeded places/treks)
#   ./scripts/start-demo.sh --no-metro # only the servers (for the admin panel or an installed APK)
#
# Press Ctrl+C once to stop everything. Logs of the API and admin panel are in .logs/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS="$ROOT/.logs"
mkdir -p "$LOGS"
step() { printf '\n\033[1;34m== %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$1"; }

SEED=0
METRO=1
for arg in "$@"; do
  case "$arg" in
    --seed) SEED=1 ;;
    --no-metro) METRO=0 ;;   # only the servers, e.g. for the admin panel or an installed APK
    *) echo "Unknown option: $arg (use --seed and/or --no-metro)"; exit 1 ;;
  esac
done

step "1. Database and Redis"
if ! pg_isready -q; then
  echo "PostgreSQL is stopped; starting it"
  brew services start postgresql@16 >/dev/null
  for _ in {1..20}; do pg_isready -q && break; sleep 1; done
fi
pg_isready || { warn "PostgreSQL did not start. Run: brew services start postgresql@16"; exit 1; }
if ! redis-cli ping >/dev/null 2>&1; then
  brew services start redis >/dev/null
  sleep 1
fi
redis-cli ping >/dev/null 2>&1 && echo "Redis: PONG" || warn "Redis is not running (not needed in Version 1)"

step "2. Backend data and risk model"
cd "$ROOT/backend"
if [[ $SEED == 1 ]]; then
  uv run python -m app.seed
else
  uv run alembic upgrade head >/dev/null   # the schema is up to date; data is left as it is
  echo "Schema up to date (use --seed to reload data/)"
fi
if ! ls models/*.joblib >/dev/null 2>&1; then
  echo "No trained risk model yet; training it (about a minute)"
  uv run python -m app.ml.train
fi

step "3. This laptop's address for the phone"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [[ -z "$IP" ]]; then
  warn "No Wi-Fi address found. Join a Wi-Fi network or the phone's hotspot, then run this again."
  exit 1
fi
API="http://$IP:8000"
echo "API for the phone: $API"
ENV_FILE="$ROOT/mobile/.env"
[[ -f "$ENV_FILE" ]] || cp "$ROOT/mobile/.env.example" "$ENV_FILE"
OLD="$(grep -E '^EXPO_PUBLIC_API_URL=' "$ENV_FILE" | cut -d= -f2- || true)"
CLEAR=""
if [[ "$OLD" != "$API" ]]; then
  if grep -qE '^EXPO_PUBLIC_API_URL=' "$ENV_FILE"; then
    sed -i '' "s|^EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=$API|" "$ENV_FILE"
  else
    echo "EXPO_PUBLIC_API_URL=$API" >>"$ENV_FILE"
  fi
  echo "Updated mobile/.env (was: ${OLD:-not set})"
  CLEAR="-c"   # Metro must clear its cache to pick up the new address
fi

PIDS=()
cleanup() {
  [[ ${#PIDS[@]} -eq 0 ]] && return 0   # nothing was started by this script
  printf '\nStopping the API and the admin panel started by this script...\n'
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

step "4. API (port 8000) and admin panel (port 5173)"
if curl -sf http://localhost:8000/health >/dev/null; then
  echo "An API is already running on port 8000; using it (it must have been started with --host 0.0.0.0)"
else
  cd "$ROOT/backend"
  uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 >"$LOGS/api.log" 2>&1 &
  PIDS+=($!)
fi
if lsof -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "The admin panel is already running on port 5173; using it"
else
  cd "$ROOT/admin"
  npm run dev -- --host >"$LOGS/admin.log" 2>&1 &
  PIDS+=($!)
fi
for _ in {1..30}; do curl -sf http://localhost:8000/health >/dev/null && break; sleep 1; done
if curl -sf http://localhost:8000/health >/dev/null; then
  echo "API:   $API/health is OK   (docs: http://localhost:8000/docs)"
else
  warn "The API did not start; see .logs/api.log"; exit 1
fi
echo "Admin: http://localhost:5173   (log in with your admin account)"
echo "Logs:  .logs/api.log, .logs/admin.log"

if [[ $METRO == 0 ]]; then
  if [[ ${#PIDS[@]} -eq 0 ]]; then
    echo "Both servers were already running; nothing new was started."
    exit 0
  fi
  echo "Servers are running. Press Ctrl+C to stop them."
  wait
  exit 0
fi

step "5. Mobile app (Metro)"
echo "Open the Bato app (the development build) on the phone. The phone must be on the same network."
echo "Press Ctrl+C to stop everything."
cd "$ROOT/mobile"
npx expo start $CLEAR
