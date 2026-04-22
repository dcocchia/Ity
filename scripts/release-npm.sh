#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME="$(node -p "require('./package.json').name")"
VERSION="$(node -p "require('./package.json').version")"
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
NPM_CACHE_DIR="/tmp/${PACKAGE_NAME}-npm-release-cache"
VERIFY_CACHE_DIR="/tmp/${PACKAGE_NAME}-npm-verify-cache"

echo "==> Checking git branch"
CURRENT_BRANCH="$(git branch --show-current)"
if [ "$CURRENT_BRANCH" != "master" ]; then
  echo "ERROR: release must run from master (current: $CURRENT_BRANCH)"
  exit 1
fi

echo "==> Checking clean working tree"
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is not clean"
  git status --short
  exit 1
fi

echo "==> Checking Node version"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERROR: release requires Node 20+ (current: $(node -v))"
  echo "Use \`nvm use\` to load the repo runtime from .nvmrc."
  exit 1
fi

echo "==> Pulling latest master"
git fetch origin
git pull --ff-only origin master

echo "==> Checking npm authentication"
if ! npm whoami >/dev/null 2>&1; then
  echo "ERROR: npm auth failed"
  echo "Run:"
  echo "  npm config delete //registry.npmjs.org/:_authToken"
  echo "  npm login --registry=https://registry.npmjs.org --auth-type=web"
  echo "Then rerun this script."
  exit 1
fi

echo "==> Checking whether ${PACKAGE_NAME}@${VERSION} is already published"
if npm view "${PACKAGE_NAME}@${VERSION}" version --registry https://registry.npmjs.org >/dev/null 2>&1; then
  echo "ERROR: ${PACKAGE_NAME}@${VERSION} is already published"
  exit 1
fi

echo "==> Installing clean dependencies"
npm --cache "$NPM_CACHE_DIR" ci

echo "==> Running tests"
npm test -- --runInBand --coverage=false

echo "==> Building distributables"
npm run build

echo "==> Testing built dist bundle"
npm run test:dist -- --runInBand --coverage=false

echo "==> Verifying package contents"
npm --cache "$NPM_CACHE_DIR" pack --dry-run

echo "==> Checking build/test did not leave tracked changes"
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: build/test changed tracked files"
  git status --short
  exit 1
fi

echo "==> Publishing ${PACKAGE_NAME}@${VERSION}"
echo "npm may prompt for browser auth / 2FA; complete it and the script will continue."
npm publish --access public

echo "==> Waiting for npm registry propagation"
for _ in $(seq 1 30); do
  PUBLISHED_VERSION="$(npm view "${PACKAGE_NAME}@${VERSION}" version --registry https://registry.npmjs.org --cache "$VERIFY_CACHE_DIR" 2>/dev/null || true)"
  if [ "$PUBLISHED_VERSION" = "$VERSION" ]; then
    break
  fi
  sleep 3
done

PUBLISHED_VERSION="$(npm view "${PACKAGE_NAME}@${VERSION}" version --registry https://registry.npmjs.org --cache "$VERIFY_CACHE_DIR")"
if [ "$PUBLISHED_VERSION" != "$VERSION" ]; then
  echo "ERROR: npm publish verification failed"
  exit 1
fi

echo "==> Creating git tag v${VERSION}"
if ! git rev-parse "v${VERSION}" >/dev/null 2>&1; then
  git tag "v${VERSION}"
fi

echo "==> Pushing git tag v${VERSION}"
if ! git ls-remote --exit-code --tags origin "v${VERSION}" >/dev/null 2>&1; then
  git push origin "v${VERSION}"
fi

echo "==> Release complete"
echo "npm: https://www.npmjs.com/package/${PACKAGE_NAME}/v/${VERSION}"
echo "tag: v${VERSION}"
