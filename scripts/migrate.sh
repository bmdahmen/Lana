#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:---local}"

for f in migrations/*.sql; do
  echo "Applying $f ($TARGET)..."
  npx wrangler d1 execute lana "$TARGET" --file="$f"
done
