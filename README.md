# tree-sitter-flux

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for
**Flux-Lang** (`.flux`) — the human-writable text form of a
[flux](https://github.com/codewandler/flux) execution graph.

This is the tree-sitter counterpart to
[`codewandler/flux-editors`](https://github.com/codewandler/flux-editors) (which
ships the TextMate grammar + IntelliJ plugin). Tree-sitter is what powers
highlighting in **Helix**, **Neovim**, and **Zed** — none of which read TextMate
grammars — and it is also the route to GitHub/Linguist code-view highlighting.

## What it highlights

The grammar recognises the full editor-facing surface, matching the token classes
of the upstream TextMate/IntelliJ tooling (the *superset* — it also colours
aspirational nodes like `type`/`pipe`/`race`/`try`/`await`, not only the stricter
runtime-parsed subset):

- declarations — `flow`, `op`, `agent`, `channel`, `datasource`, `trigger`,
  `journey`, `type` (records + `|` unions)
- statements — binds (`$x =` / `+=`), `do` calls, `when`/`else`/`unless`,
  `each`/`repeat`/`until`/`loop`, `match`/`route`/`case`/`default`,
  `fallback`/`branch`/`parallel`/`seq`, `retry`, `timeout`/`budget`, `ctx`,
  `assert`, `confirm`, `return`, `with_tools`, `goal`
- expressions — dotted/kebab op calls (`babelforce-manager.acd.create_queue`),
  `$var.field` access, named arguments (`schema: CallerSlots`), object/array
  literals, `fmt(...)`
- literals — strings with `{interpolation}`, verbatim `"""triple"""` strings,
  numbers, booleans, `null`
- annotations — `@effect(...)`, and `@json <compact-json>` (with JSON injected
  into the escape via `injections.scm`)
- `secret "ENV"` references, comments

## Design note — line-oriented, not indentation-tracked

Flux is indentation-structured, but a full `INDENT`/`DEDENT` external scanner is a
classic source of subtle bugs (multi-level dedent, comment lines, multi-line
`"""` strings). This grammar deliberately avoids that:

- Top-level **declarations own their body** — the run of statements/attributes up
  to the next top-level keyword — so declarations fold and scope correctly.
- Bodies are **flat within a declaration**: a `when` header and the lines beneath
  it are siblings. The grammar tracks no indentation depth.
- The **one** indentation fact it needs — telling an indented body line
  (`agent triage` inside a `trigger`) apart from a new top-level declaration
  (`agent foo` at column 0) — is provided by a tiny external scanner
  ([`src/scanner.c`](src/scanner.c)): a single zero-width `_line_start` token that
  fires only at column 0. No indent stack, no state.

The result is a grammar that is robust for **highlighting** — it does not ERROR on
real files — at the cost of not modelling every nesting level. This mirrors how
the upstream TextMate/IntelliJ tooling behaves. If you need deep block nesting
(fine-grained folding of each `when`/`each` body, block-scoped locals), that is a
future full-indentation scanner; see the tracking issue.

## Install in an editor

### Helix

Add to `~/.config/helix/languages.toml`:

```toml
[[language]]
name = "flux"
scope = "source.flux"
file-types = ["flux"]
comment-token = "#"
indent = { tab-width = 2, unit = "  " }
# optional: wire the flux LSP for diagnostics/hover/completion
# language-servers = ["flux-lsp"]

[[grammar]]
name = "flux"
source = { git = "https://github.com/codewandler/flux-tree-sitter", rev = "main" }
```

Then fetch, build, and install the queries:

```sh
hx --grammar fetch
hx --grammar build
# copy queries where Helix looks for them:
mkdir -p ~/.config/helix/runtime/queries/flux
cp queries/*.scm ~/.config/helix/runtime/queries/flux/
```

> Note: Helix highlights via tree-sitter only — it does **not** render LSP
> semantic tokens (as of 25.07). Colour comes entirely from this grammar +
> `highlights.scm`; a flux LSP contributes diagnostics/hover/completion, not
> token colours.

### Neovim (nvim-treesitter)

```lua
local parser_config = require("nvim-treesitter.parsers").get_parser_configs()
parser_config.flux = {
  install_info = {
    url = "https://github.com/codewandler/flux-tree-sitter",
    files = { "src/parser.c", "src/scanner.c" },
    branch = "main",
  },
  filetype = "flux",
}
vim.filetype.add({ extension = { flux = "flux" } })
```

Then `:TSInstall flux`, and copy `queries/*.scm` into
`queries/flux/` on your runtimepath. (Unlike Helix, Neovim *can* also apply LSP
semantic tokens on top.)

## Develop

```sh
npm install                 # dev deps (tree-sitter CLI)
npx tree-sitter generate    # regenerate src/ from grammar.js
npx tree-sitter test        # run the corpus tests in test/corpus/
npx tree-sitter parse examples/contact-centre.flux   # inspect a parse tree
npx tree-sitter highlight examples/contact-centre.flux
```

Bindings are provided for **Node** and **Rust** (standard tree-sitter
boilerplate). The C parser + external scanner are compiled and exercised by
`tree-sitter test`.

## Status

Verified: `tree-sitter generate` is conflict-free; the corpus tests pass; the
bundled examples (`examples/demo.flux` from flux-editors, and
`examples/contact-centre.flux`) parse with **zero** ERROR/MISSING nodes; the
`highlights.scm` query compiles and captures against them.

## License

Dual-licensed under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), matching
the flux projects.
