# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The README example is now a syntax-highlighted image (`assets/example.svg`)
  generated from `examples/readme-example.flux` by `scripts/render-example.mjs`,
  coloured by this grammar's own `queries/highlights.scm` — since GitHub cannot
  highlight `.flux` natively.

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
