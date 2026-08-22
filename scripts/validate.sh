#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"

cd "${PROJECT_ROOT}"

echo "🔍 Running validate..."
pnpm validate
echo "✅ Validate passed!"
