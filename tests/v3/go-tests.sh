#!/bin/sh
# Assemble the same frozen backend and overlays used by the product.
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd -P)
: "${WORKBENCH_MULTICA_SRC:?请设置冻结的 Multica 源码目录}"
expected=a7859a4715fd589d9460512ad805588210a5f0c5
test "$(git -C "$WORKBENCH_MULTICA_SRC" rev-parse HEAD)" = "$expected"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -C "$WORKBENCH_MULTICA_SRC" archive "$expected" server | tar -xf - -C "$tmp"
GIT_CEILING_DIRECTORIES="$(dirname "$tmp")" git -C "$tmp" apply --whitespace=nowarn "$root/deploy/v3/backend.patch"
cp -R "$root/deploy/v3/server/." "$tmp/server/"
cd "$tmp/server"
GOTOOLCHAIN=go1.26.9 go test -count=1 ./internal/projectplan ./internal/workbench ./internal/qoderruntime
GOTOOLCHAIN=go1.26.9 go test -count=1 -run 'TestQoder(Catalog|ConnectionSecrets|BaseURL|Overrides)' ./internal/handler
