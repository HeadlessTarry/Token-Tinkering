#!/usr/bin/env bash
set -euo pipefail

echo "✅ Running pre-commit checks..."
# no-commit-to-branch guards commits, not code; skip it so checks also pass on main.
SKIP=no-commit-to-branch node_modules/.bin/prek run --all-files

echo ""
echo "✅ All checks passed!"
