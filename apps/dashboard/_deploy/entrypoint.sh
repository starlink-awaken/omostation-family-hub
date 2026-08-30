#!/bin/sh
set -e

if [ -z "${FAMILY_DOCUMENTS_ROOT:-}" ]; then
  echo "FATAL: FAMILY_DOCUMENTS_ROOT is not set"
  exit 1
fi

if [ ! -d "${FAMILY_DOCUMENTS_ROOT}" ]; then
  echo "FATAL: Documents directory not found: ${FAMILY_DOCUMENTS_ROOT}"
  exit 1
fi

if [ -z "${FAMILY_DASHBOARD_STATE_ROOT:-}" ] || [ ! -d "${FAMILY_DASHBOARD_STATE_ROOT}/manifests" ]; then
  echo "FATAL: provisioned dashboard state/manifests directory is required"
  exit 1
fi

# Incremental build: skip if SSOT mtime <= previous build time
META_FILE="${FAMILY_DASHBOARD_STATE_ROOT}/generated/build-meta.json"
NEED_BUILD=1
if [ -f "$META_FILE" ]; then
  BUILT_AT=$(cat "$META_FILE" | grep -o '"builtAt":"[^"]*"' | cut -d'"' -f4 2>/dev/null)
  if [ -n "$BUILT_AT" ]; then
    BUILT_EPOCH=$(date -d "$BUILT_AT" +%s 2>/dev/null)
    if [ -n "$BUILT_EPOCH" ]; then
      LATEST_DOCUMENT=$(find "${FAMILY_DOCUMENTS_ROOT}" -type f \( -name "*.md" -o -name "*.yaml" \) -newermt "@$BUILT_EPOCH" 2>/dev/null | head -1)
      if [ -z "$LATEST_DOCUMENT" ]; then
        echo "==> Documents unchanged since last build, skipping"
        NEED_BUILD=0
      fi
    fi
  fi
fi

if [ "$NEED_BUILD" = "1" ]; then
  echo "==> Building generated state from read-only Documents..."
  bun run scripts/verify-paths.ts
  bun run scripts/build-all.ts
else
  echo "==> Using cached generated state"
fi

echo "==> Starting Next.js standalone on port ${PORT:-3000}..."
exec bun server.js
