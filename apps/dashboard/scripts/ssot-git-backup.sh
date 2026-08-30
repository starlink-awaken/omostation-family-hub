#!/bin/bash
# SSOT Git 自动备份脚本（宿主机运行）
# 用法:
#   bash scripts/ssot-git-backup.sh              # 立即备份
#   bash scripts/ssot-git-backup.sh --quiet       # 静默模式（仅输出错误）
#
# 建议配合 macOS launchd 或 crontab 定时运行：
#   30 18 * * * /bin/bash /path/to/scripts/ssot-git-backup.sh --quiet

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../" && pwd)"
PARENT_DIR="$(cd "$APP_DIR/../../" && pwd)"
QUIET=false

if [ "$1" = "--quiet" ]; then
  QUIET=true
fi

log() {
  if [ "$QUIET" = false ]; then
    echo "$@"
  fi
}

cd "$PARENT_DIR"

if [ ! -d ".git" ]; then
  echo "ERROR: not a git repository: $PARENT_DIR"
  exit 1
fi

git add -A

if git diff --cached --quiet; then
  log "SSOT: no changes to commit"
  exit 0
fi

git commit -m "auto backup $(date -u +%Y-%m-%dT%H:%M:%SZ)"

log "SSOT: backup committed"
log "  files changed: $(git diff --cached --name-only | wc -l | tr -d ' ')"
