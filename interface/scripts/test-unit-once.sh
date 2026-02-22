#!/usr/bin/env sh
set -eu

# Run interface unit tests once (non-watch) to avoid long-running processes in CI/automation.
# IMPORTANT: run from the interface workspace so vitest picks up the right config/aliases.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Prefer the package script so config stays consistent.
bun run test:unit:once
