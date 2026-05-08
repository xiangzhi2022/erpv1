#!/bin/bash
# ============================================================
#  青崖全屋定制ERP - 一键启动脚本
#  功能：检查环境 → 安装依赖 → 启动服务 → 等待就绪 → 打印访问地址
# ============================================================

set -Eeuo pipefail

# ── 颜色输出 ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
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
MAX_WAIT=90  # 最大等待秒数
IS_PROD="${COZE_PROJECT_ENV:-DEV}"

cd "${PROJECT_DIR}"

# ── Step 1: 环境检查 ─────────────────────────────────────────
log_step "Step 1/7: 环境检查"

# 检查 Node.js
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  log_success "Node.js ${NODE_VER}"
else
  log_error "Node.js 未安装！"
  exit 1
fi

# 检查 pnpm
if command -v pnpm &>/dev/null; then
  PNPM_VER=$(pnpm -v)
  log_success "pnpm ${PNPM_VER}"
else
  log_warn "pnpm 未安装，正在安装..."
  npm install -g pnpm 2>/dev/null && log_success "pnpm 安装成功" || { log_error "pnpm 安装失败"; exit 1; }
fi

# 检查项目文件
if [[ -f "package.json" ]]; then
  log_success "package.json 存在"
else
  log_error "package.json 不存在，请确认项目目录: ${PROJECT_DIR}"
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

# 显示环境模式
if [[ "${IS_PROD}" == "PROD" ]]; then
  log_info "运行模式: ${BOLD}生产环境 (PROD)${NC}"
else
  log_info "运行模式: ${BOLD}开发环境 (DEV)${NC}"
fi

# ── Step 2: 安装依赖 ─────────────────────────────────────────
log_step "Step 2/7: 安装依赖"

if [[ -d "node_modules" ]] && [[ -f "pnpm-lock.yaml" ]]; then
  log_info "node_modules 已存在，检查是否需要更新..."
  pnpm install --prefer-frozen-lockfile --prefer-offline 2>&1 | tail -5
  log_success "依赖安装完成"
else
  log_info "首次安装依赖..."
  pnpm install 2>&1 | tail -10
  log_success "依赖安装完成"
fi

# ── Step 3: 构建（生产环境） ─────────────────────────────────
if [[ "${IS_PROD}" == "PROD" ]]; then
  log_step "Step 3/7: 构建生产版本"
  bash scripts/build.sh 2>&1 | tail -20
  log_success "构建完成"
else
  log_step "Step 3/7: 跳过构建（开发模式）"
  log_info "开发模式使用 tsx watch 热更新，无需构建"
fi

# ── Step 4: 清理端口 ─────────────────────────────────────────
log_step "Step 4/7: 清理端口"

# 检查端口是否被占用（仅检查 LISTEN 状态）
pids=$(ss -H -lntp 2>/dev/null | awk -v port="${PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)

if [[ -n "${pids}" ]]; then
  log_warn "端口 ${PORT} 被进程 ${pids} 占用，正在清理..."
  echo "${pids}" | xargs -I {} kill -9 {} 2>/dev/null || true
  sleep 1
  # 再次检查
  pids2=$(ss -H -lntp 2>/dev/null | awk -v port="${PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
  if [[ -n "${pids2}" ]]; then
    log_error "端口 ${PORT} 仍被占用，请手动处理 (PIDs: ${pids2})"
    exit 1
  fi
  log_success "端口 ${PORT} 已清理"
else
  log_success "端口 ${PORT} 空闲"
fi

# ── Step 5: 启动服务 ─────────────────────────────────────────
log_step "Step 5/7: 启动服务"

mkdir -p "${LOG_DIR}"

if [[ "${IS_PROD}" == "PROD" ]]; then
  log_info "启动生产服务器 (端口: ${PORT})..."
  nohup bash scripts/start.sh > "${LOG_DIR}/app.log" 2>&1 &
else
  log_info "启动开发服务器 (端口: ${PORT})..."
  nohup bash scripts/dev.sh > "${LOG_DIR}/app.log" 2>&1 &
fi

SERVER_PID=$!
log_info "服务进程 PID: ${SERVER_PID}"

# ── Step 6: 等待服务就绪 ─────────────────────────────────────
log_step "Step 6/7: 等待服务就绪"

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

# ── Step 7: 健康检查 & 输出访问信息 ─────────────────────────
log_step "Step 7/7: 健康检查 & 访问信息"

# 健康检查关键 API
API_ENDPOINTS=("/api/auth/login")
for endpoint in "${API_ENDPOINTS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:${PORT}${endpoint}" 2>/dev/null || echo "000")
  if [[ "${STATUS}" =~ ^[2-4] ]]; then
    log_success "API ${endpoint} → HTTP ${STATUS}"
  else
    log_warn "API ${endpoint} → HTTP ${STATUS} (可能未就绪)"
  fi
done

# ── 解析访问地址 ──────────────────────────────────────────────
DOMAIN="${COZE_PROJECT_DOMAIN_DEFAULT:-}"

# 标准化：确保是完整 URL
if [[ -n "${DOMAIN}" ]]; then
  # 去除尾部斜杠
  DOMAIN="${DOMAIN%/}"
  # 如果没有协议前缀，补上 https://
  if [[ ! "${DOMAIN}" =~ ^https?:// ]]; then
    ACCESS_URL="https://${DOMAIN}"
  else
    ACCESS_URL="${DOMAIN}"
  fi
else
  ACCESS_URL="http://localhost:${PORT}"
fi

# ── 打印启动成功横幅 ─────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${NC}"
echo -e "${BOLD}${GREEN}┃                                                                  ┃${NC}"
echo -e "${BOLD}${GREEN}┃          ${NC}${BOLD}青崖全屋定制ERP  启动成功!${NC}                                  ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃                                                                  ┃${NC}"
echo -e "${BOLD}${GREEN}┠━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫${NC}"
echo -e "${BOLD}${GREEN}┃                                                                  ┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}  ${BOLD}${CYAN}外网访问地址:${NC}                                                  ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}                                                                  ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}    ${BOLD}${WHITE}${ACCESS_URL}${NC}                    ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}                                                                  ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┠━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫${NC}"
echo -e "${BOLD}${GREEN}┃${NC}                                                                  ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}  ${DIM}本地地址:${NC}   http://localhost:${PORT}                              ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}  ${DIM}服务端口:${NC}   ${PORT}                                                ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}  ${DIM}运行模式:${NC}   ${IS_PROD}                                               ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}  ${DIM}服务 PID:${NC}   ${SERVER_PID}                                             ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}                                                                  ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┠━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫${NC}"
echo -e "${BOLD}${GREEN}┃${NC}                                                                  ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}  ${BOLD}超级管理员登录:${NC}                                               ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}    手机号: 13800000000                                          ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}    密  码: 19840214aA                                            ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}                                                                  ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┠━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫${NC}"
echo -e "${BOLD}${GREEN}┃${NC}                                                                  ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}  ${DIM}日志目录: ${LOG_DIR}/${NC}                     ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}  ${DIM}停止服务: kill ${SERVER_PID}${NC}                                ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}  ${DIM}查看日志: tail -f ${LOG_DIR}/app.log${NC}          ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┃${NC}                                                                  ${BOLD}${GREEN}┃${NC}"
echo -e "${BOLD}${GREEN}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${NC}"
echo ""

# ── 持续监控（可选） ─────────────────────────────────────────
log_info "服务已启动，按 Ctrl+C 退出监控（服务将继续在后台运行）"

# 简单的进程存活监控
while kill -0 ${SERVER_PID} 2>/dev/null; do
  sleep 10
done

log_error "服务进程 ${SERVER_PID} 已退出！"
tail -n 30 "${LOG_DIR}/app.log" 2>/dev/null
exit 1
