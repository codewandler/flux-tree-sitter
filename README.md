# flux-tree-sitter

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for
**Flux-Lang** (`.flux`) — the human-writable text form of a
[flux](https://github.com/codewandler/flux) execution graph.

Tree-sitter is what powers syntax highlighting in **Helix**, **Neovim**, and
**Zed** — none of which read TextMate grammars — and it is the route to
GitHub/Linguist code-view highlighting. This is the tree-sitter counterpart to
[`codewandler/flux-editors`](https://github.com/codewandler/flux-editors), which
ships the TextMate grammar and IntelliJ plugin.

> **Naming.** The package (npm / crate) is **`flux-tree-sitter`**. The tree-sitter
> *language* is **`flux`** — so the generated C entrypoint is `tree_sitter_flux()`
> and the parser name you reference in Helix/Neovim is `flux`. That is the
> language name, not the project name; it does not change.
>
> **Setting up your editor with an agent?** Point it at
> [`AGENTS.md`](AGENTS.md) — it has copy-pasteable, idempotent setup steps.

## Example

````flux
flow route-call(utterance: String, caller_id: String) -> RouteResult
  # one model-cost step: extract intent + slots
  $extract = intent_extract($utterance, schema: CallerSlots, intents: Intent)

  @effect(network)
  $ctx = booking_lookup($caller_id)

  when $extract.intent == "book_flight"
    confirm "Create booking to {slots.destination}?", risk: medium
      $booking = booking_create($extract.slots, caller: $caller_id)
      return { intent: $extract.intent, ref: $booking.ref }
  else
    do escalate "no-match", $utterance
    return "escalated"
````

## What it highlights

The grammar recognises the full editor-facing surface, matching the token classes
of the upstream TextMate/IntelliJ tooling — the *superset* (it also colours
aspirational nodes like `type`/`pipe`/`race`/`try`/`await`, not only the stricter
runtime-parsed subset):

- **Declarations** — `flow`, `op`, `agent`, `channel`, `datasource`, `trigger`,
  `journey`, `type` (records + `|` unions)
- **Statements** — binds (`$x =` / `+=`), `do` calls, `when`/`else`/`unless`,
  `each`/`repeat`/`until`/`loop`, `match`/`route`/`case`/`default`,
  `fallback`/`branch`/`parallel`/`seq`, `retry`, `timeout`/`budget`, `ctx`,
  `assert`, `confirm`, `return`, `with_tools`, `goal`
- **Expressions** — dotted/kebab op calls (`babelforce-manager.acd.create_queue`),
  `$var.field` access, named arguments (`schema: CallerSlots`), object/array
  literals, `fmt(...)`
- **Literals** — strings with `{interpolation}`, verbatim `"""triple"""` strings,
  numbers, booleans, `null`
- **Annotations** — `@effect(...)`, and `@json <compact-json>` (with the JSON
  injected into the escape via `injections.scm`)
- `secret "ENV"` references, comments

## Design — line-oriented, not indentation-tracked

Flux is indentation-structured, but a full `INDENT`/`DEDENT` external scanner is a
classic source of subtle bugs (multi-level dedent, comment lines, multi-line
`"""` strings). This grammar deliberately avoids that:

- Top-level **declarations own their body** — the run of statements/attributes up
  to the next top-level keyword — so declarations fold and scope correctly.
- Bodies are **flat within a declaration**: a `when` header and the lines beneath
  it are siblings. The grammar tracks no indentation depth.
- The **one** indentation fact it needs — telling an indented body line
  (`agent triage` inside a `trigger`) apart from a new top-level declaration
  (`agent foo` at column 0) — comes from a tiny external scanner
  ([`src/scanner.c`](src/scanner.c)): a single zero-width `_line_start` token that
  fires only at column 0. No indent stack, no state.

The result is robust for **highlighting** — it does not ERROR on real files — at
the cost of not modelling every nesting level, mirroring the upstream
TextMate/IntelliJ tooling. Deep block nesting (fine-grained folding of each
`when`/`each` body, block-scoped locals) would be a future full-indentation
scanner.

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
mkdir -p ~/.config/helix/runtime/queries/flux
cp queries/*.scm ~/.config/helix/runtime/queries/flux/
```

> Helix highlights via tree-sitter only — it does **not** render LSP semantic
> tokens (as of 25.07). Colour comes entirely from this grammar +
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

Then `:TSInstall flux` and copy `queries/*.scm` into `queries/flux/` on your
runtimepath. (Unlike Helix, Neovim *can* also apply LSP semantic tokens on top.)

## Develop

```sh
npm install                 # dev deps (the tree-sitter CLI)
npx tree-sitter generate    # regenerate src/ from grammar.js
npx tree-sitter test        # run the corpus tests in test/corpus/
npx tree-sitter parse examples/contact-centre.flux     # inspect a parse tree
npx tree-sitter highlight examples/contact-centre.flux # needs a theme in ~/.config/tree-sitter/config.json
```

Bindings are provided for **Node** and **Rust** (standard tree-sitter
boilerplate). The C parser + external scanner are compiled and exercised by
`tree-sitter test`. See [`AGENTS.md`](AGENTS.md) for the contributor/agent
workflow and invariants.

## Status

Verified in CI: `tree-sitter generate` is conflict-free and `src/` is in sync;
the corpus tests pass; the bundled examples (`examples/demo.flux` from
flux-editors, and `examples/contact-centre.flux`) parse with **zero**
ERROR/MISSING nodes; the `highlights.scm` query compiles and captures against
them.

## License

Dual-licensed under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), matching
the flux projects.
