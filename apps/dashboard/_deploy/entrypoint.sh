#!/bin/sh
set -e

if [ -z "${FAMILY_SSOT_ROOT}" ]; then
  echo "FATAL: FAMILY_SSOT_ROOT is not set"
  exit 1
fi

if [ ! -d "${FAMILY_SSOT_ROOT}" ]; then
  echo "FATAL: SSOT directory not found: ${FAMILY_SSOT_ROOT}"
  exit 1
fi

# Incremental build: skip if SSOT mtime <= previous build time
META_FILE="/app/app-data/build-meta.json"
NEED_BUILD=1
if [ -f "$META_FILE" ]; then
  BUILT_AT=$(cat "$META_FILE" | grep -o '"builtAt":"[^"]*"' | cut -d'"' -f4 2>/dev/null)
  if [ -n "$BUILT_AT" ]; then
    BUILT_EPOCH=$(date -d "$BUILT_AT" +%s 2>/dev/null)
    if [ -n "$BUILT_EPOCH" ]; then
      LATEST_SSOT=$(find "${FAMILY_SSOT_ROOT}" -type f \( -name "*.md" -o -name "*.yaml" \) -newermt "@$BUILT_EPOCH" 2>/dev/null | head -1)
      if [ -z "$LATEST_SSOT" ]; then
        echo "==> SSOT unchanged since last build, skipping"
        NEED_BUILD=0
      fi
    fi
  fi
fi

if [ "$NEED_BUILD" = "1" ]; then
  echo "==> Building app-data from SSOT (${FAMILY_SSOT_ROOT})..."
  bun run scripts/verify-paths.ts
  bun run scripts/build-all.ts
else
  echo "==> Using cached app-data"
fi

echo "==> Starting Next.js standalone on port ${PORT:-3000}..."
exec bun server.js
