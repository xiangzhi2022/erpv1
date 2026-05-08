#!/bin/bash
# push-workflows.sh - 推送 GitHub Actions workflow 文件到远程仓库
# 需要具有 workflow scope 的 GitHub Personal Access Token
#
# 使用方法:
#   GH_TOKEN=ghp_your_token_here bash scripts/push-workflows.sh
#
# 创建 PAT 的步骤:
#   1. 访问 https://github.com/settings/tokens
#   2. 点击 "Generate new token (classic)"
#   3. 勾选 "workflow" scope
#   4. 生成并复制 token
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

if [ -z "${GH_TOKEN:-}" ]; then
  echo "❌ Error: GH_TOKEN environment variable is required."
  echo ""
  echo "Usage: GH_TOKEN=ghp_your_token bash scripts/push-workflows.sh"
  echo ""
  echo "To create a token with workflow scope:"
  echo "  1. Go to https://github.com/settings/tokens"
  echo "  2. Generate new token (classic)"
  echo "  3. Check 'workflow' scope"
  echo "  4. Copy the generated token"
  exit 1
fi

REPO="xiangzhi2022/erpv1"
BRANCH="main"
API_URL="https://api.github.com/repos/${REPO}/contents"

echo "🚀 Pushing workflow files via GitHub API..."

# Function to create or update a file via GitHub API
push_file() {
  local file_path="$1"
  local remote_path="$2"
  local message="$3"

  # Base64 encode the file content
  local content
  content=$(base64 -w 0 "${file_path}")

  # Check if file already exists (to get SHA for update)
  local sha=""
  sha=$(curl -s -H "Authorization: token ${GH_TOKEN}" \
    "${API_URL}/${remote_path}?ref=${BRANCH}" | grep -o '"sha":"[^"]*"' | head -1 | cut -d'"' -f4 || true)

  # Build request body
  local body
  if [ -n "${sha}" ]; then
    body="{\"message\":\"${message}\",\"content\":\"${content}\",\"sha\":\"${sha}\",\"branch\":\"${BRANCH}\"}"
  else
    body="{\"message\":\"${message}\",\"content\":\"${content}\",\"branch\":\"${BRANCH}\"}"
  fi

  # Push via API
  local response
  response=$(curl -s -w "\n%{http_code}" -X PUT \
    -H "Authorization: token ${GH_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    -d "${body}" \
    "${API_URL}/${remote_path}")

  local http_code
  http_code=$(echo "${response}" | tail -1)

  if [ "${http_code}" -ge 200 ] && [ "${http_code}" -lt 300 ]; then
    echo "✅ Pushed: ${remote_path}"
  else
    echo "❌ Failed to push: ${remote_path} (HTTP ${http_code})"
    echo "${response}" | head -5
  fi
}

# Push auto-sync workflow
push_file ".github/workflows/auto-sync.yml" ".github/workflows/auto-sync.yml" "ci: add auto-sync GitHub Actions workflow"

# Push manual-sync workflow
push_file ".github/workflows/manual-sync.yml" ".github/workflows/manual-sync.yml" "ci: add manual-sync GitHub Actions workflow"

echo ""
echo "✅ Workflow files push completed!"
echo "   Check: https://github.com/${REPO}/actions"
