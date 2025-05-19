#!/usr/bin/env bash
set -euo pipefail        # fail fast, abort on unset vars, pipe errors propagate

########### 1 – Select Node version ###########################################
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
source "$NVM_DIR/nvm.sh"

NODE_VERSION=20         # bump here when you need a newer major
echo "→ Installing Node $NODE_VERSION with nvm"
nvm install "$NODE_VERSION"
nvm use     "$NODE_VERSION"

########### 2 – Prep optional system libs (only if you need native add-ons) ###
# Uncomment if you rely on node-gyp / bcrypt / sharp, etc.
# sudo apt-get update
# sudo apt-get install -y build-essential python3

########### 3 – Install JS dependencies ######################################
echo "→ Running deterministic npm install"
npm ci --omit=optional --no-audit --fund=false

########### 4 – Private registry token (optional) ############################
# if you set NPM_TOKEN in Codex’s env-var pane, this picks it up
if [[ -n "${NPM_TOKEN:-}" ]]; then
  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
  echo "→ Injected auth token for private registry"
fi

echo "✓ setup.sh completed"
