#!/bin/bash
# setup-runner.sh - GitHub Actions Self-hosted Runner 一键安装配置脚本
# 使用方法: bash setup-runner.sh
set -Eeuo pipefail

RUNNER_VERSION="2.334.0"
RUNNER_DIR="/workspace/actions-runner"
REPO_URL="https://github.com/xiangzhi2022/erpv1"
RUNNER_TOKEN="A5T6SA6EVM4MA2K7D2WWON3J7S4PW"

echo "============================================"
echo "  GitHub Actions Self-hosted Runner Setup"
echo "============================================"

# 1. 创建目录
mkdir -p "${RUNNER_DIR}"
cd "${RUNNER_DIR}"

# 2. 下载 runner
echo "📥 Downloading GitHub Actions Runner v${RUNNER_VERSION}..."
curl -o "actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
  -L "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

# 3. 校验哈希
echo "🔐 Verifying download hash..."
echo "048024cd2c848eb6f14d5646d56c13a4def2ae7ee3ad12122bee960c56f3d271  actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" | shasum -a 256 -c

# 4. 解压
echo "📦 Extracting runner..."
tar xzf "./actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

# 5. 配置 runner
echo "⚙️  Configuring runner..."
./config.sh --url "${REPO_URL}" --token "${RUNNER_TOKEN}" --name "erpv1-runner" --labels "self-hosted,erpv1" --unattended --replace

# 6. 安装为系统服务（可选，但推荐）
echo "🔧 Installing runner as a service..."
./svc.sh install

# 7. 启动服务
echo "🚀 Starting runner service..."
./svc.sh start

echo ""
echo "✅ GitHub Actions Self-hosted Runner setup completed!"
echo ""
echo "📌 Runner details:"
echo "   - Directory: ${RUNNER_DIR}"
echo "   - Repository: ${REPO_URL}"
echo "   - Runner name: erpv1-runner"
echo "   - Labels: self-hosted, erpv1"
echo ""
echo "📌 Useful commands:"
echo "   - Check status:  cd ${RUNNER_DIR} && ./svc.sh status"
echo "   - Stop runner:   cd ${RUNNER_DIR} && ./svc.sh stop"
echo "   - Start runner:  cd ${RUNNER_DIR} && ./svc.sh start"
echo "   - Remove runner: cd ${RUNNER_DIR} && ./config.sh remove --token ${RUNNER_TOKEN}"
echo ""
echo "📌 In your workflow YAML, use:"
echo "   runs-on: self-hosted"
