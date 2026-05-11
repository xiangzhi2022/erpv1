#!/usr/bin/env bash
# ============================================================
# ERP local startup script
# Works best in Git Bash on Windows.
#
# Usage:
#   bash start-local.sh
#   bash start-local.sh --kill-port
#   bash start-local.sh --prod
#   bash start-local.sh --foreground
# ============================================================

set -Eeuo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()    { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}\n"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-${SCRIPT_DIR}}"
PORT="${PORT:-5000}"
MODE="dev"
KILL_PORT=0
INSTALL_DEPS=1
FOREGROUND=0
MAX_WAIT="${MAX_WAIT:-90}"
LOG_DIR="${LOG_DIR:-${PROJECT_DIR}/logs/local}"
PID_FILE="${LOG_DIR}/server.pid"
LOG_FILE="${LOG_DIR}/app.log"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prod)
      MODE="prod"
      ;;
    --dev)
      MODE="dev"
      ;;
    --kill-port)
      KILL_PORT=1
      ;;
    --no-install)
      INSTALL_DEPS=0
      ;;
    --foreground)
      FOREGROUND=1
      ;;
    -h|--help)
      sed -n '1,18p' "$0"
      exit 0
      ;;
    *)
      log_error "Unknown argument: $1"
      exit 1
      ;;
  esac
  shift
done

cd "${PROJECT_DIR}"
mkdir -p "${LOG_DIR}"

log_step "Step 1/6: Environment check"

if command -v node >/dev/null 2>&1; then
  log_success "Node.js $(node -v)"
else
  log_error "Node.js is not installed or not in PATH."
  exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
  log_success "pnpm $(pnpm -v)"
else
  log_error "pnpm is not installed or not in PATH."
  log_info "Install it with: npm install -g pnpm@9.0.0"
  exit 1
fi

if [[ ! -f "package.json" ]]; then
  log_error "package.json not found in ${PROJECT_DIR}"
  exit 1
fi
log_success "Project directory: ${PROJECT_DIR}"

load_env_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
    log_success "Loaded ${file}"
  fi
}

load_env_file ".env.local"
load_env_file ".env"

if [[ -z "${COZE_SUPABASE_URL:-}" && -z "${SUPABASE_URL:-}" ]]; then
  log_warn "Supabase URL is not configured. API/database features may fail."
fi

log_info "Mode: ${MODE}"
log_info "Port: ${PORT}"
log_info "Log file: ${LOG_FILE}"

log_step "Step 2/6: Install dependencies"

if [[ "${INSTALL_DEPS}" == "1" ]]; then
  if [[ -d "node_modules" ]]; then
    log_info "node_modules exists; checking dependencies with frozen lockfile..."
    pnpm install --frozen-lockfile --prefer-offline
  else
    log_info "node_modules missing; installing dependencies..."
    pnpm install --frozen-lockfile
  fi
  log_success "Dependencies ready"
else
  log_warn "Skipping dependency install because --no-install was provided"
fi

get_port_pids() {
  local port="$1"
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command \
      "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique" \
      2>/dev/null | tr -d '\r' | grep -E '^[0-9]+$' || true
  else
    netstat -ano 2>/dev/null | awk -v port=":${port}" '$2 ~ port && $4 == "LISTENING" {print $5}' | sort -u || true
  fi
}

kill_pids() {
  local pids="$1"
  if [[ -z "${pids}" ]]; then
    return
  fi

  if command -v taskkill.exe >/dev/null 2>&1; then
    while read -r pid; do
      [[ -z "${pid}" ]] && continue
      taskkill.exe //PID "${pid}" //F >/dev/null 2>&1 || true
    done <<< "${pids}"
  else
    while read -r pid; do
      [[ -z "${pid}" ]] && continue
      kill -9 "${pid}" >/dev/null 2>&1 || true
    done <<< "${pids}"
  fi
}

log_step "Step 3/6: Port check"

PORT_PIDS="$(get_port_pids "${PORT}")"
if [[ -n "${PORT_PIDS}" ]]; then
  log_warn "Port ${PORT} is already in use by PID(s): ${PORT_PIDS//$'\n'/, }"
  if [[ "${KILL_PORT}" == "1" ]]; then
    log_warn "Killing process(es) on port ${PORT} because --kill-port was provided"
    kill_pids "${PORT_PIDS}"
    sleep 1
    PORT_PIDS="$(get_port_pids "${PORT}")"
    if [[ -n "${PORT_PIDS}" ]]; then
      log_error "Port ${PORT} is still busy: ${PORT_PIDS//$'\n'/, }"
      exit 1
    fi
    log_success "Port ${PORT} cleared"
  else
    log_error "Port ${PORT} is busy. Re-run with --kill-port or choose another port: PORT=5001 bash start-local.sh"
    exit 1
  fi
else
  log_success "Port ${PORT} is free"
fi

log_step "Step 4/6: Build or prepare server"

if [[ "${MODE}" == "prod" ]]; then
  log_info "Building production server..."
  pnpm build
  START_CMD=(pnpm start)
else
  log_info "Development mode: using tsx watch on src/server.ts"
  START_CMD=(pnpm tsx watch src/server.ts)
fi

export PORT
export DEPLOY_RUN_PORT="${PORT}"
export COZE_WORKSPACE_PATH="${PROJECT_DIR}"
export COZE_PROJECT_ENV="${COZE_PROJECT_ENV:-DEV}"

log_step "Step 5/6: Start service"

if [[ "${FOREGROUND}" == "1" ]]; then
  log_info "Starting in foreground. Press Ctrl+C to stop."
  exec "${START_CMD[@]}"
fi

if [[ -f "${PID_FILE}" ]]; then
  OLD_PID="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${OLD_PID}" ]] && kill -0 "${OLD_PID}" >/dev/null 2>&1; then
    log_warn "Previous PID file exists and process is running: ${OLD_PID}"
  fi
fi

log_info "Starting in background..."
nohup "${START_CMD[@]}" > "${LOG_FILE}" 2>&1 &
SERVER_PID=$!
echo "${SERVER_PID}" > "${PID_FILE}"
log_success "Server PID: ${SERVER_PID}"

log_step "Step 6/6: Wait for readiness"

elapsed=0
while [[ ${elapsed} -lt ${MAX_WAIT} ]]; do
  if ! kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    log_error "Server process exited. Last logs:"
    tail -n 40 "${LOG_FILE}" 2>/dev/null || true
    exit 1
  fi

  if curl -s -o /dev/null --max-time 2 "http://localhost:${PORT}" 2>/dev/null; then
    log_success "Server is ready after ${elapsed}s"
    echo ""
    echo -e "${BOLD}${GREEN}ERP local server started${NC}"
    echo "URL:      http://localhost:${PORT}"
    echo "PID:      ${SERVER_PID}"
    echo "Log:      ${LOG_FILE}"
    echo "Stop:     bash stop-local.sh  或  taskkill //PID ${SERVER_PID} //F"
    echo ""
    exit 0
  fi

  echo -ne "\r${YELLOW}Waiting... ${elapsed}s/${MAX_WAIT}s${NC}"
  sleep 2
  elapsed=$((elapsed + 2))
done

echo ""
log_error "Startup timed out after ${MAX_WAIT}s. Last logs:"
tail -n 60 "${LOG_FILE}" 2>/dev/null || true
exit 1
