#!/bin/sh
set -eu
umask 077
cd "$(dirname "$0")/.."
root="$(pwd -P)"
research="$(cd ../.. && pwd -P)"
multica="${WORKBENCH_MULTICA_SRC:-$research/.local/demo-v2/src/multica}"
client="${WORKBENCH_V2_SRC:-$research/.local/demo-v2/src/mobile-work-client}"
dsh="${WORKBENCH_DSH_SRC:-$research/../deepseek-harness}"
check_head() {
  if [ "$(git -C "$1" rev-parse HEAD)" != "$2" ]; then
    printf '冻结版本不匹配：%s\n' "$1" >&2
    exit 1
  fi
}
standalone="${WORKBENCH_STANDALONE:-0}"
if [ "$standalone" != 1 ]; then
  check_head "$multica" a7859a4715fd589d9460512ad805588210a5f0c5
  check_head "$client" dbf36f4d2a9b69779c18cb5fec22ce3ee6302a69
  check_head "$dsh" ca33fd6843b205e279c7ccb6cb73a472c78f5760
fi
runtime="${WORKBENCH_RUNTIME:-$root/.local/v2-runtime}"
mkdir -p "$runtime/bin" "$runtime/logs" "$runtime/upstream"
patch="$root/deploy/multica.patch"
if [ -x "$runtime/bin/api" ] && [ -x "$runtime/bin/migrate" ] &&
   [ -x "$runtime/bin/multica" ] && [ -d "$runtime/migrations" ] && cmp -s "$0" "$runtime/bin/prepare-multica.sh"; then
  if [ "$standalone" != 1 ] || { cmp -s "$patch" "$runtime/bin/multica.patch" &&
       [ -x "$runtime/workbench-pi/node_modules/.bin/pi" ]; }; then
    exit 0
  fi
fi
src="$(mktemp -d "$runtime/upstream/multica.XXXXXX")"
trap 'rm -rf "$src"' EXIT
if [ "$standalone" = 1 ]; then
  base=7a12304f1473c71e0cee970c773246eaf96abc49
  archive="$runtime/upstream/multica-$base.tar.gz"
  if [ ! -f "$archive" ]; then
    curl --fail --silent --show-error --location --retry 2 \
      -o "$src/upstream.tar.gz" "https://codeload.github.com/multica-ai/multica/tar.gz/$base"
    mv "$src/upstream.tar.gz" "$archive"
  fi
  if [ "$(shasum -a 256 "$archive" | cut -d ' ' -f 1)" != 7525deff9e94eccbda10ea80febac0c5f30352df1ba0ee5ab70dabce082201b1 ]; then
    rm "$archive"
    printf '%s\n' 'Multica 源码校验失败。请重新运行 setup。' >&2
    exit 1
  fi
  tar -xzf "$archive" -C "$src" --strip-components 1 "multica-$base/server"
  GIT_CEILING_DIRECTORIES="$(dirname "$src")" git -C "$src" apply --whitespace=nowarn "$patch"
  pnpm --dir "$src/server/workbench-pi" install --frozen-lockfile --ignore-scripts
else
  git -C "$multica" archive HEAD server | tar -xf - -C "$src"
fi
# Keep this development API loopback-only; leave profiling and maintenance disabled.
python3 - "$src/server" <<'PY'
from pathlib import Path
import sys
server = Path(sys.argv[1])
path = server / "cmd/server/main.go"
source = path.read_text()
old = 'newMainHTTPServer(":"+port, r)'
assert source.count(old) == 1
source = source.replace(old, 'newMainHTTPServer("127.0.0.1:"+port, r)')
old = """	go func() {
		slog.Info("pprof server starting", "addr", profilingServer.Addr)
		if err := profilingServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("pprof server disabled after startup error", "error", err)
		}
	}()
"""
assert source.count(old) == 1
path.write_text(source.replace(old, ""))

# Workbench's picker can refresh after a CLI login or import. Multica's API
# force flag skips its server cache, but the daemon also memoizes discovery.
# Let a model-list job refresh the Codex memo through the existing enumerator.
def replace_once(source, old, new):
    assert source.count(old) == 1, old
    return source.replace(old, new, 1)

path = server / "pkg/agent/models.go"
source = replace_once(path.read_text(), '''\tcase "codex":
\t\treturn cachedDiscovery(discoveryCacheKey(providerType, runtimeCmd), func() (Catalog, error) {
\t\t\treturn discoverCodexCatalog(ctx, runtimeCmd), nil
\t\t})''', '''\tcase "codex":
\t\treturn cachedDiscovery(discoveryCacheKey(providerType, runtimeCmd), func() (Catalog, error) {
\t\t\treturn discoverCodexCatalog(ctx, runtimeCmd), nil
\t\t}, ctx.Value(freshModelDiscoveryKey{}) != nil)''')
source = replace_once(source, '''// cachedDiscovery invokes fn and caches the result for modelCacheTTL.''',
'''type freshModelDiscoveryKey struct{}

// WithFreshModelDiscovery lets an interactive model-list job bypass the Codex discovery memo.
func WithFreshModelDiscovery(ctx context.Context) context.Context {
\treturn context.WithValue(ctx, freshModelDiscoveryKey{}, true)
}

// cachedDiscovery invokes fn and caches the result for modelCacheTTL.''')
source = replace_once(source, '''func cachedDiscovery(key string, fn func() (Catalog, error)) (Catalog, error) {
\tmodelCacheMu.Lock()
\tif entry, ok := modelCache[key]; ok && time.Now().Before(entry.expiresAt) {''',
'''func cachedDiscovery(key string, fn func() (Catalog, error), refresh ...bool) (Catalog, error) {
\tmodelCacheMu.Lock()
\tif entry, ok := modelCache[key]; ok && time.Now().Before(entry.expiresAt) &&
\t\t(len(refresh) == 0 || !refresh[0]) {''')
path.write_text(source)

path = server / "internal/daemon/daemon.go"
path.write_text(replace_once(path.read_text(),
    'catalog, err := listModels(ctx, rt.Provider, agent.NewCommand(execPath, fixedArgs))',
    'catalog, err := listModels(agent.WithFreshModelDiscovery(ctx), rt.Provider, agent.NewCommand(execPath, fixedArgs))'))
PY
(
  mkdir "$src/build"
  cd "$src/server"
  for tool in server migrate multica; do
    GOTOOLCHAIN=go1.26.9 go build -p 4 -trimpath -o "$src/build/$tool" "./cmd/$tool"
  done
)
mv "$src/build/server" "$runtime/bin/api"
mv "$src/build/migrate" "$runtime/bin/migrate"
mv "$src/build/multica" "$runtime/bin/multica"
if [ "$standalone" = 1 ]; then
  rm -rf "$runtime/migrations" "$runtime/workbench-pi"
  mv "$src/server/migrations" "$runtime/migrations"
  mv "$src/server/workbench-pi" "$runtime/workbench-pi"
  cp "$patch" "$runtime/bin/multica.patch"
elif [ ! -d "$runtime/migrations" ]; then
  mv "$src/server/migrations" "$runtime/migrations"
fi
cp "$0" "$runtime/bin/prepare-multica.sh"
