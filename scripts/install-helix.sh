#!/usr/bin/env bash

set -euo pipefail

repository="${FLUX_TREE_SITTER_REPOSITORY:-https://github.com/codewandler/flux-tree-sitter}"
revision="${FLUX_TREE_SITTER_REV:-}"
hx_bin="${HX_BIN:-hx}"
git_bin="${GIT_BIN:-git}"

usage() {
  cat <<'EOF'
Install or update Flux-Lang highlighting for Helix.

Usage: install-helix.sh [--repository URL] [--rev COMMIT]

The installer:
  - resolves the repository's main branch to an immutable commit;
  - registers or updates the Flux grammar without replacing an existing Flux language block;
  - fetches and builds only the Flux grammar;
  - installs the matching highlight, injection, and locals queries; and
  - runs `hx --health flux`.

Environment overrides:
  FLUX_TREE_SITTER_REPOSITORY  grammar repository URL
  FLUX_TREE_SITTER_REV         immutable commit to install
  HX_BIN                       Helix executable (default: hx)
  GIT_BIN                      Git executable (default: git)
  XDG_CONFIG_HOME              standard config root used by Helix
  HELIX_RUNTIME                explicit Helix runtime directory
EOF
}

die() {
  printf 'flux-tree-sitter: %s\n' "$*" >&2
  exit 1
}

while (($# > 0)); do
  case "$1" in
    --repository)
      (($# >= 2)) || die "--repository requires a value"
      repository=$2
      shift 2
      ;;
    --rev)
      (($# >= 2)) || die "--rev requires a value"
      revision=$2
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

command -v "$hx_bin" >/dev/null 2>&1 || die "Helix was not found; install hx first"

if [[ -z "$revision" ]]; then
  command -v "$git_bin" >/dev/null 2>&1 || die "Git is required to resolve the grammar revision"
  remote_ref=$(
    "$git_bin" ls-remote "$repository" refs/heads/main |
      awk 'NR == 1 { print $1 }'
  )
  [[ -n "$remote_ref" ]] || die "could not resolve $repository main"
  revision=$remote_ref
fi

[[ "$revision" =~ ^[0-9A-Fa-f]{40}$ ]] || die "revision must be a full 40-character Git commit"
[[ "$repository" != *'"'* && "$repository" != *$'\n'* ]] || die "repository URL contains unsupported characters"

config_home="${XDG_CONFIG_HOME:-${HOME:?HOME is not set}/.config}"
helix_dir="$config_home/helix"
runtime_dir="${HELIX_RUNTIME:-$helix_dir/runtime}"
config_file="$helix_dir/languages.toml"

mkdir -p "$helix_dir"
touch "$config_file"

work_dir=$(mktemp -d "${TMPDIR:-/tmp}/flux-helix.XXXXXX")
original_config="$work_dir/languages.original.toml"
final_config="$work_dir/languages.final.toml"
build_config="$work_dir/languages.build.toml"
cp "$config_file" "$original_config"

installed=0
cleanup() {
  if ((installed == 0)); then
    cp "$original_config" "$config_file"
  fi
  rm -rf "$work_dir"
}
trap cleanup EXIT

source_line="source = { git = \"$repository\", rev = \"$revision\" }"

# Buffer language/grammar array entries so an existing Flux language block (including an LSP
# choice) is retained, while the Flux grammar source is pinned and duplicate grammar entries are
# removed. Other user configuration is emitted byte-for-byte, apart from a final newline.
awk -v source_line="$source_line" '
  function reset_block(    i) {
    for (i in lines) delete lines[i]
    count = 0
    kind = ""
    block_name = ""
  }

  function flush_block(    i, saw_source, is_flux) {
    if (count == 0) return

    is_flux = block_name == "flux"
    if (kind == "grammar" && is_flux) {
      if (seen_flux_grammar) {
        reset_block()
        return
      }

      seen_flux_grammar = 1
      saw_source = 0
      for (i = 1; i <= count; i++) {
        if (lines[i] ~ /^[[:space:]]*source[[:space:]]*=/) {
          if (!saw_source) print source_line
          saw_source = 1
        } else {
          print lines[i]
        }
      }
      if (!saw_source) print source_line
    } else {
      for (i = 1; i <= count; i++) print lines[i]
      if (kind == "language" && is_flux) seen_flux_language = 1
    }
    reset_block()
  }

  /^[[:space:]]*\[\[language\]\][[:space:]]*(#.*)?$/ {
    flush_block()
    kind = "language"
    lines[++count] = $0
    next
  }

  /^[[:space:]]*\[\[grammar\]\][[:space:]]*(#.*)?$/ {
    flush_block()
    kind = "grammar"
    lines[++count] = $0
    next
  }

  count > 0 && /^[[:space:]]*\[/ {
    flush_block()
    print
    next
  }

  count > 0 {
    lines[++count] = $0
    if ($0 ~ /^[[:space:]]*name[[:space:]]*=[[:space:]]*"flux"[[:space:]]*(#.*)?$/) {
      block_name = "flux"
    }
    next
  }

  { print }

  END {
    flush_block()

    if (!seen_flux_language) {
      print ""
      print "# Added by codewandler/flux-tree-sitter scripts/install-helix.sh."
      print "[[language]]"
      print "name = \"flux\""
      print "scope = \"source.flux\""
      print "file-types = [\"flux\"]"
      print "comment-token = \"#\""
      print "indent = { tab-width = 2, unit = \"  \" }"
    }

    if (!seen_flux_grammar) {
      print ""
      print "# Pinned by codewandler/flux-tree-sitter scripts/install-helix.sh."
      print "[[grammar]]"
      print "name = \"flux\""
      print source_line
    }
  }
' "$config_file" >"$final_config"

# `use-grammars` controls fetch/build only. Override it just for these two commands so installing
# Flux never downloads Helix's entire grammar catalog, then restore the user's permanent choice.
{
  printf 'use-grammars = { only = ["flux"] }\n'
  awk '!/^[[:space:]]*use-grammars[[:space:]]*=/' "$final_config"
} >"$build_config"
cp "$build_config" "$config_file"

printf 'Installing Flux-Lang grammar %.12s for Helix...\n' "$revision"
(
  cd "$helix_dir"
  "$hx_bin" --grammar fetch
  "$hx_bin" --grammar build
)

source_queries="$runtime_dir/grammars/sources/flux/queries"
query_dest="$runtime_dir/queries/flux"
shopt -s nullglob
query_files=("$source_queries"/*.scm)
((${#query_files[@]} > 0)) || die "Helix fetched no Flux query files under $source_queries"
mkdir -p "$query_dest"
cp "${query_files[@]}" "$query_dest/"

# Health should observe the user's lasting config rather than the temporary build-only selection.
cp "$final_config" "$config_file"
(
  cd "$helix_dir"
  "$hx_bin" --health flux
)

installed=1
printf '\nFlux-Lang highlighting is installed at %.12s. Restart Helix to reload it.\n' "$revision"
