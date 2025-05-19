#!/usr/bin/env bash
set -euo pipefail

# 1 – pick your Node
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm install 20
nvm use     20

# 2 – make sure dev deps install
export NODE_ENV=development        # <-- critical line
npm ci --omit=optional             # or: npm ci --include=dev --omit=optional

# 3 – inject private-registry token if supplied
if [[ -n "${NPM_TOKEN:-}" ]]; then
  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
fi

echo "✓ setup.sh completed"
