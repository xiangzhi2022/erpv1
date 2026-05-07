#!/bin/bash
# ============================================================
#  青崖全屋定制ERP - 一键启动脚本
#  功能：检查环境 → 安装缺失依赖 → 启动前后端 → 打印访问地址
# ============================================================

set -Eeuo pipefail

# ── 颜色输出 ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()    { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}\n"; }

# ── 变量 ──────────────────────────────────────────────────────
PROJECT_DIR="${COZE_WORKSPACE_PATH:-/workspace/projects}"
PORT="${DEPLOY_RUN_PORT:-5000}"
LOG_DIR="/app/work/logs/bypass"
MAX_WAIT=60  # 最大等待秒数

cd "${PROJECT_DIR}"

# ── Step 1: 环境检查 ─────────────────────────────────────────
log_step "Step 1: 环境检查"

# 检查 Node.js
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  log_success "Node.js ${NODE_VER} 已安装"
else
  log_error "Node.js 未安装！"
  exit 1
fi

# 检查 pnpm
if command -v pnpm &>/dev/null; then
  PNPM_VER=$(pnpm -v)
  log_success "pnpm ${PNPM_VER} 已安装"
else
  log_warn "pnpm 未安装，正在安装..."
  npm install -g pnpm 2>/dev/null && log_success "pnpm 安装成功" || { log_error "pnvm 安装失败"; exit 1; }
fi

# 检查项目文件
if [[ -f "package.json" ]]; then
  log_success "package.json 存在"
else
  log_error "package.json 不存在，请确认项目目录"
  exit 1
fi

# 检查 .env.local
if [[ -f ".env.local" ]]; then
  log_success ".env.local 环境配置存在"
else
  log_warn ".env.local 不存在，部分功能可能异常"
fi

# 检查 Supabase 环境变量
if [[ -n "${COZE_SUPABASE_URL:-}" ]]; then
  log_success "Supabase URL 已配置"
else
  log_warn "COZE_SUPABASE_URL 未设置"
fi

# ── Step 2: 安装依赖 ─────────────────────────────────────────
log_step "Step 2: 安装依赖"

if [[ -d "node_modules" ]] && [[ -f "pnpm-lock.yaml" ]]; then
  log_info "node_modules 已存在，检查是否需要更新..."
  pnpm install --prefer-frozen-lockfile --prefer-offline 2>&1 | tail -5
  log_success "依赖安装完成"
else
  log_info "首次安装依赖..."
  pnpm install 2>&1 | tail -10
  log_success "依赖安装完成"
fi

# ── Step 3: 清理端口 ─────────────────────────────────────────
log_step "Step 3: 清理端口"

# 检查端口是否被占用（仅检查 LISTEN 状态）
pids=$(ss -H -lntp 2>/dev/null | awk -v port="${PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)

if [[ -n "${pids}" ]]; then
  log_warn "端口 ${PORT} 被进程 ${pids} 占用，正在清理..."
  echo "${pids}" | xargs -I {} kill -9 {} 2>/dev/null || true
  sleep 1
  # 再次检查
  pids2=$(ss -H -lntp 2>/dev/null | awk -v port="${PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
  if [[ -n "${pids2}" ]]; then
    log_error "端口 ${PORT} 仍被占用，请手动处理"
    exit 1
  fi
  log_success "端口 ${PORT} 已清理"
else
  log_success "端口 ${PORT} 空闲"
fi

# ── Step 4: 创建日志目录 ─────────────────────────────────────
mkdir -p "${LOG_DIR}"

# ── Step 5: 启动服务 ─────────────────────────────────────────
log_step "Step 5: 启动前后端服务"

log_info "正在启动开发服务器 (端口: ${PORT})..."

# 使用 nohup 后台启动，日志重定向
nohup bash scripts/dev.sh > "${LOG_DIR}/app.log" 2>&1 &
SERVER_PID=$!
log_info "服务进程 PID: ${SERVER_PID}"

# ── Step 6: 等待服务就绪 ─────────────────────────────────────
log_step "Step 6: 等待服务就绪"

elapsed=0
while [[ ${elapsed} -lt ${MAX_WAIT} ]]; do
  # 检查进程是否还活着
  if ! kill -0 ${SERVER_PID} 2>/dev/null; then
    log_error "服务进程已退出！查看日志："
    tail -n 20 "${LOG_DIR}/app.log" 2>/dev/null
    exit 1
  fi

  # 检查 HTTP 是否可连接
  if curl -s -o /dev/null -w '' --max-time 2 "http://localhost:${PORT}" 2>/dev/null; then
    echo ""
    log_success "服务已成功启动！(耗时 ${elapsed}s)"
    break
  fi

  echo -ne "\r${YELLOW}等待服务就绪... ${elapsed}s/${MAX_WAIT}s${NC}"
  sleep 2
  elapsed=$((elapsed + 2))
done

if [[ ${elapsed} -ge ${MAX_WAIT} ]]; then
  echo ""
  log_error "服务启动超时 (${MAX_WAIT}s)，查看日志："
  tail -n 30 "${LOG_DIR}/app.log" 2>/dev/null
  exit 1
fi

# ── Step 7: 输出访问信息 ─────────────────────────────────────
log_step "Step 7: 访问信息"

DOMAIN="${COZE_PROJECT_DOMAIN_DEFAULT:-}"

echo -e ""
echo -e "${BOLD}${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║          青崖全屋定制ERP 启动成功!                      ║${NC}"
echo -e "${BOLD}${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}${GREEN}║                                                        ║${NC}"

if [[ -n "${DOMAIN}" ]]; then
  echo -e "${BOLD}${GREEN}║  外网访问: https://${DOMAIN}                    ║${NC}"
else
  echo -e "${BOLD}${GREEN}║  本地访问: http://localhost:${PORT}                       ║${NC}"
fi

echo -e "${BOLD}${GREEN}║                                                        ║${NC}"
echo -e "${BOLD}${GREEN}║  超级管理员登录:                                        ║${NC}"
echo -e "${BOLD}${GREEN}║    手机号: 13800000000                                 ║${NC}"
echo -e "${BOLD}${GREEN}║    密码:   19840214aA                                   ║${NC}"
echo -e "${BOLD}${GREEN}║                                                        ║${NC}"
echo -e "${BOLD}${GREEN}║  日志目录: ${LOG_DIR}/                       ║${NC}"
echo -e "${BOLD}${GREEN}║  停止服务: kill ${SERVER_PID}                             ║${NC}"
echo -e "${BOLD}${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo -e ""

# ── Step 8: 健康检查 ─────────────────────────────────────────
log_step "Step 8: 快速健康检查"

# 检查关键 API
API_CHECKS=(
  "/api/auth/login"
)

for endpoint in "${API_CHECKS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://localhost:${PORT}${endpoint}" 2>/dev/null || echo "000")
  if [[ "${STATUS}" =~ ^[2-4] ]]; then
    log_success "API ${endpoint} → HTTP ${STATUS}"
  else
    log_warn "API ${endpoint} → HTTP ${STATUS} (可能未就绪)"
  fi
done

echo -e "\n${BOLD}${CYAN}启动流程全部完成！${NC}\n"
