#!/bin/bash
# pre-sync.sh - 代码变更前的自动拉取脚本
# 用途：AI 开始代码变更前自动从 GitHub 拉取最新代码
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

echo "⬇️  Pulling latest changes from origin/main..."

# 暂存本地变更（如果有）
STASH_NEEDED=false
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
  echo "📦 Stashing local changes before pull..."
  if git stash push -m "auto-stash before pull at $(date '+%Y-%m-%d %H:%M:%S')" 2>&1; then
    STASH_NEEDED=true
  fi
fi

# 拉取远程变更
git pull --rebase origin main 2>&1 || {
  echo "⚠️  Pull failed. Attempting to resolve..."
  git rebase --abort 2>/dev/null || true
  git pull origin main 2>&1 || {
    echo "❌ Pull failed. Manual intervention may be required."
    exit 1
  }
}

# 恢复暂存的变更
if [ "${STASH_NEEDED}" = true ]; then
  echo "📦 Restoring stashed changes..."
  if git stash list | head -1 | grep -q "auto-stash"; then
    git stash pop 2>&1 || {
      echo "⚠️  Stash pop failed. Conflicts may need manual resolution."
      echo "   Run 'git stash list' and 'git stash pop' manually."
    }
  fi
fi

echo "✅ Pre-sync completed. Local repo is up to date."
