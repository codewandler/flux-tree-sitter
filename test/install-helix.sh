#!/usr/bin/env bash

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
installer="$repo_root/scripts/install-helix.sh"
revision=0123456789abcdef0123456789abcdef01234567
tmp=$(mktemp -d "${TMPDIR:-/tmp}/flux-helix-test.XXXXXX")
trap 'rm -rf "$tmp"' EXIT

fail() {
  printf 'install-helix test: %s\n' "$*" >&2
  exit 1
}

assert_count() {
  local expected=$1
  local pattern=$2
  local file=$3
  local actual
  actual=$(grep -cE "$pattern" "$file" || true)
  [[ "$actual" == "$expected" ]] || fail "expected $expected matches for $pattern in $file, got $actual"
}

make_fake_hx() {
  local root=$1
  mkdir -p "$root/bin"
  cat >"$root/bin/hx" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
config="$XDG_CONFIG_HOME/helix/languages.toml"
printf '%s\n' "$*" >>"$HX_TEST_LOG"
case "$*" in
  "--grammar fetch" | "--grammar build")
    grep -Fx 'use-grammars = { only = ["flux"] }' "$config" >/dev/null
    if grep -Fx 'use-grammars = { only = ["rust"] }' "$config" >/dev/null; then
      printf 'permanent grammar selection leaked into build config\n' >&2
      exit 1
    fi
    if [[ "$*" == "--grammar fetch" && "${HX_TEST_FAIL_FETCH:-0}" == 1 ]]; then
      exit 42
    fi
    ;;
  "--health flux")
    printf 'Tree-sitter parser: ✓\nHighlight queries: ✓\n'
    ;;
  *)
    printf 'unexpected hx invocation: %s\n' "$*" >&2
    exit 1
    ;;
esac
EOF
  chmod +x "$root/bin/hx"
}

seed_queries() {
  local config_home=$1
  local source="$config_home/helix/runtime/grammars/sources/flux/queries"
  mkdir -p "$source"
  cp "$repo_root"/queries/*.scm "$source/"
}

run_existing_config_case() {
  local root="$tmp/existing"
  local config_home="$root/config"
  local config="$config_home/helix/languages.toml"
  local log="$root/hx.log"
  mkdir -p "$(dirname "$config")"
  make_fake_hx "$root"
  seed_queries "$config_home"

  cat >"$config" <<'EOF'
use-grammars = { only = ["rust"] }

[language-server.flux-lsp]
command = "flux-lsp"

[[language]]
name = "flux"
scope = "source.flux"
file-types = ["flux"]
language-servers = ["flux-lsp"]

[[grammar]]
name = "flux"
source = { git = "https://example.invalid/old", rev = "main" }
EOF

  for _ in 1 2; do
    XDG_CONFIG_HOME="$config_home" \
      HX_BIN="$root/bin/hx" \
      HX_TEST_LOG="$log" \
      FLUX_TREE_SITTER_REV="$revision" \
      "$installer" >/dev/null
  done

  grep -Fx 'use-grammars = { only = ["rust"] }' "$config" >/dev/null ||
    fail "installer did not restore the permanent grammar selection"
  grep -Fx 'language-servers = ["flux-lsp"]' "$config" >/dev/null ||
    fail "installer did not preserve the existing Flux language block"
  grep -F "rev = \"$revision\"" "$config" >/dev/null ||
    fail "installer did not pin the requested revision"
  assert_count 2 '^name = "flux"$' "$config"
  assert_count 1 '^\[\[language\]\]$' "$config"
  assert_count 1 '^\[\[grammar\]\]$' "$config"
  assert_count 2 '^--grammar fetch$' "$log"
  assert_count 2 '^--grammar build$' "$log"
  assert_count 2 '^--health flux$' "$log"

  for query in "$repo_root"/queries/*.scm; do
    cmp "$query" "$config_home/helix/runtime/queries/flux/$(basename "$query")"
  done
}

run_empty_config_case() {
  local root="$tmp/empty"
  local config_home="$root/config"
  local config="$config_home/helix/languages.toml"
  local log="$root/hx.log"
  mkdir -p "$(dirname "$config")"
  make_fake_hx "$root"
  seed_queries "$config_home"

  XDG_CONFIG_HOME="$config_home" \
    HX_BIN="$root/bin/hx" \
    HX_TEST_LOG="$log" \
    FLUX_TREE_SITTER_REV="$revision" \
    bash <"$installer" >/dev/null

  grep -Fx 'scope = "source.flux"' "$config" >/dev/null ||
    fail "installer did not add the Flux language"
  grep -F "rev = \"$revision\"" "$config" >/dev/null ||
    fail "installer did not add the Flux grammar"
  if grep -q '^use-grammars' "$config"; then
    fail "temporary grammar selection leaked into a new config"
  fi
}

run_rollback_case() {
  local root="$tmp/rollback"
  local config_home="$root/config"
  local config="$config_home/helix/languages.toml"
  local expected="$root/languages.expected.toml"
  local log="$root/hx.log"
  local status
  mkdir -p "$(dirname "$config")"
  make_fake_hx "$root"
  seed_queries "$config_home"

  cat >"$config" <<'EOF'
use-grammars = { except = ["yaml"] }

[[language]]
name = "rust"
scope = "source.rust"
EOF
  cp "$config" "$expected"

  set +e
  XDG_CONFIG_HOME="$config_home" \
    HX_BIN="$root/bin/hx" \
    HX_TEST_LOG="$log" \
    HX_TEST_FAIL_FETCH=1 \
    FLUX_TREE_SITTER_REV="$revision" \
    "$installer" >/dev/null 2>&1
  status=$?
  set -e

  ((status != 0)) || fail "installer unexpectedly succeeded when hx fetch failed"
  cmp "$expected" "$config" || fail "installer did not roll back config after failure"
}

bash -n "$installer"
run_existing_config_case
run_empty_config_case
run_rollback_case
printf 'install-helix tests: ok\n'
