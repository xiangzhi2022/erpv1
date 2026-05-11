#!/usr/bin/env bash
# Stop the local ERP server started by start-local.sh.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${LOG_DIR:-${SCRIPT_DIR}/logs/local}"
PID_FILE="${LOG_DIR}/server.pid"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "[INFO] No PID file found: ${PID_FILE}"
  exit 0
fi

PID="$(cat "${PID_FILE}" 2>/dev/null || true)"
if [[ -z "${PID}" ]]; then
  echo "[WARN] PID file is empty: ${PID_FILE}"
  rm -f "${PID_FILE}"
  exit 0
fi

if command -v taskkill.exe >/dev/null 2>&1; then
  taskkill.exe //PID "${PID}" //F >/dev/null 2>&1 || true
else
  kill "${PID}" >/dev/null 2>&1 || true
fi

rm -f "${PID_FILE}"
echo "[OK] Stopped local server PID ${PID}"
