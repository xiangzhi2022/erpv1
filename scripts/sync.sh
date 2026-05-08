#!/bin/bash
# sync.sh - 自动同步脚本：在代码变更完成后自动提交并推送到 GitHub
# 用途：AI 代码变更完成后的自动推送触发器
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

# 检查是否有变更（排除 .github/workflows 因为需要 workflow scope）
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "ℹ️  No changes to sync."
  exit 0
fi

# 生成时间戳
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# 添加所有变更（.github/workflows/ 已在 .gitignore 中排除）
git add -A

# 生成提交信息
COMMIT_MSG="auto-sync: ${TIMESTAMP}"

# 提交
git commit -m "${COMMIT_MSG}" || {
  echo "ℹ️  Nothing to commit (possibly only whitespace changes)."
  exit 0
}

# 推送到远程
echo "🚀 Pushing to origin/main..."
if git push origin main 2>&1; then
  echo "✅ Sync completed: ${COMMIT_MSG}"
else
  echo "⚠️  Push failed. Attempting pull-rebase-push..."
  git pull --rebase origin main 2>&1 || true
  if git push origin main 2>&1; then
    echo "✅ Sync completed after rebase: ${COMMIT_MSG}"
  else
    echo "❌ Push failed after rebase. Changes are committed locally."
    echo "   Run 'git push origin main' manually when ready."
    exit 1
  fi
fi
