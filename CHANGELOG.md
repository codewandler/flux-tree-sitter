# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The README example is now a syntax-highlighted image (`assets/example.svg`)
  generated from `examples/readme-example.flux` — since GitHub cannot highlight
  `.flux` natively.
- `scripts/install-helix.sh` provides one idempotent Helix install/update path: immutable revision
  pinning, Flux-only fetch/build, matched query installation, config preservation/rollback, and
  health verification. Its isolated regression test runs in CI.

### Changed

- Doc-image generation moved to the flux CLI: `assets/example.svg` is regenerated
  with `flux render examples/readme-example.flux -o assets/example.svg` (flux's
  own CST-based One-Dark renderer). The `scripts/render-example.mjs` Node script
  — which shelled out to the `tree-sitter` CLI and coloured by
  `queries/highlights.scm` — is retired and removed.
- Helix onboarding now points humans and agents at the same installer. The manual fallback explains
  immutable revisions, matched parser/query updates, Flux-only grammar builds, capture inspection,
  and the distinction between health checks and theme colours.

### Fixed

- The grammar now covers current Flux-Lang plus the documented tolerant editor superset, including
  optional field access, typed binds, context appends, multiline values, durable/error/concurrency
  forms, `peek`/`thing`/`parse`, journey flow markers, and legacy header spellings.
- `fmt` accepts ordinary and triple-string templates; interpolation supports `{name}` and
  `{{name}}` while non-placeholder braces remain string content.
- Highlight captures now follow one semantic contract: every callable is `@function`, all types are
  `@type`, and `$symbols` remain consistently `@variable`. Known-operation checks stay with the
  LSP/compiler rather than a hard-coded syntax list.
- Locals queries cover the newly supported binding forms, all query files are checked in CI, and
  capture-level Rust tests prevent the `now()`/`fmt()` colour split from recurring.

## [0.1.0] - 2026-07-09

Initial release.

### Added

- **Grammar** (`grammar.js`) for Flux-Lang (`.flux`), covering the editor-facing
  superset: `flow`/`op`/`agent`/`channel`/`datasource`/`trigger`/`journey`/`type`
  declarations; all control-flow clauses (`when`/`unless`/`each`/`repeat`/`loop`/
  `match`/`route`/`fallback`/`branch`/`parallel`/`seq`/`retry`/`timeout`/`budget`/
  `ctx`/`with_tools`/`assert`/`confirm`/`return`/`goal`/`do`); dotted & kebab-case
  op calls; `$var.field` access; named arguments; object/array literals; `fmt(...)`;
  strings with `{interpolation}` and verbatim `"""triple"""` strings; `@effect(...)`
  and `@json` annotations; `secret "ENV"` references; comments.
- **External scanner** (`src/scanner.c`) — a single zero-width `_line_start` token
  that fires only at column 0, separating top-level declarations from indented
  body lines without a full `INDENT`/`DEDENT` scanner.
- **Queries** — `highlights.scm`, `injections.scm` (JSON injected into `@json`
  escape lines), `locals.scm`.
- **Bindings** for Node and Rust.
- **Tests** — corpus tests (`test/corpus/`) and example files (`examples/`,
  including `demo.flux` from `flux-editors` and an IVR/ACD `contact-centre.flux`).
- **CI** — verifies `src/` is in sync with `grammar.js`, corpus tests pass,
  examples parse with zero ERROR/MISSING nodes, the highlight query is valid, and
  the Rust binding builds.
- **Docs** — `README.md` (human), `AGENTS.md` (agent-actionable, including
  idempotent Helix/Neovim setup).

[Unreleased]: https://github.com/codewandler/flux-tree-sitter/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/codewandler/flux-tree-sitter/releases/tag/v0.1.0
