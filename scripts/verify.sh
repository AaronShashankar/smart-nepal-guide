#!/usr/bin/env bash
# Runs every automated check in the project. Usage: ./scripts/verify.sh
# Needs PostgreSQL running (the backend tests use the snguide_test database).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
step() { printf '\n\033[1;34m== %s\033[0m\n' "$1"; }

step "Backend: lint + format check"
cd "$ROOT/backend"
uv run ruff check .
uv run ruff format --check .

step "Backend: migrations match the models"
uv run alembic check

step "Backend: tests (rebuilds snguide_test from migrations + seed data)"
uv run pytest

step "Mobile: typecheck + lint"
cd "$ROOT/mobile"
npx tsc --noEmit
npx expo lint

step "Admin: typecheck + build + lint"
cd "$ROOT/admin"
npm run build >/dev/null
npm run lint

printf '\n\033[1;32mAll checks passed.\033[0m\n'
