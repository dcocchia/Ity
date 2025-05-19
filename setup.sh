#!/usr/bin/env bash
set -euo pipefail

# 1 ─ choose Node
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm install 20
nvm use     20

# 2 ─ make sure devDependencies are installed
unset NODE_ENV                 # <─--- THIS is the critical line
# or: export NODE_ENV=development
npm ci --omit=optional          # deterministic, now gets dev deps too

# 3 ─ (optional) private-registry token
if [[ -n "${NPM_TOKEN:-}" ]]; then
  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
fi

echo "✓ setup.sh completed"
