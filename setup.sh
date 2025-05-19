#!/usr/bin/env bash
set -euo pipefail

# 1 – choose Node
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm install 20
nvm use     20

# 2 – make sure devDependencies are installed
npm ci --include=dev --omit=optional   # <-- key line

# 3 – (optional) private-registry token
if [[ -n "${NPM_TOKEN:-}" ]]; then
  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
fi

echo "✓ setup.sh completed"
