//! This crate provides Flux-Lang language support for the [tree-sitter] parsing library.
//!
//! Typically, you will use the [`LANGUAGE`] constant to add this language to a
//! tree-sitter [`Parser`], and then use the parser to parse some code:
//!
//! ```
//! // NB: declarations must start at column 0 (the grammar is line-oriented).
//! let code = r#"flow greet(name: String) -> String
//!   $msg = fmt("hi {name}")
//!   return $msg
//! "#;
//! let mut parser = tree_sitter::Parser::new();
//! let language = flux_tree_sitter::LANGUAGE;
//! parser
//!     .set_language(&language.into())
//!     .expect("Error loading Flux parser");
//! let tree = parser.parse(code, None).unwrap();
//! assert!(!tree.root_node().has_error());
//! ```
//!
//! [tree-sitter]: https://tree-sitter.github.io/
//! [`Parser`]: https://docs.rs/tree-sitter/*/tree_sitter/struct.Parser.html

use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_flux() -> *const ();
}

/// The tree-sitter [`LanguageFn`] for this grammar.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_flux) };

/// The content of the [`node-types.json`] file for this grammar.
///
/// [`node-types.json`]: https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types.html
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");

/// The syntax-highlighting query for this grammar.
pub const HIGHLIGHTS_QUERY: &str = include_str!("../../queries/highlights.scm");

/// The language-injection query for this grammar.
pub const INJECTIONS_QUERY: &str = include_str!("../../queries/injections.scm");

/// The local-variable query for this grammar.
pub const LOCALS_QUERY: &str = include_str!("../../queries/locals.scm");

#[cfg(test)]
mod tests {
    use streaming_iterator::StreamingIterator;
    use tree_sitter::{Parser, Query, QueryCursor};

    fn parse(code: &str) -> tree_sitter::Tree {
        let mut parser = Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Flux parser");
        parser.parse(code, None).expect("parser returned no tree")
    }

    fn highlight_captures(code: &str) -> Vec<(String, String)> {
        let language = super::LANGUAGE.into();
        let tree = parse(code);
        let query =
            Query::new(&language, super::HIGHLIGHTS_QUERY).expect("highlights query must compile");
        let names = query.capture_names();
        let mut cursor = QueryCursor::new();
        let mut captures = cursor.captures(&query, tree.root_node(), code.as_bytes());
        let mut out = Vec::new();
        while let Some((query_match, capture_index)) = captures.next() {
            let capture = query_match.captures[*capture_index];
            out.push((
                capture
                    .node
                    .utf8_text(code.as_bytes())
                    .expect("capture text must be UTF-8")
                    .to_string(),
                names[capture.index as usize].to_string(),
            ));
        }
        out
    }

    fn assert_capture(captures: &[(String, String)], text: &str, scope: &str) {
        assert!(
            captures.iter().any(|(t, s)| t == text && s == scope),
            "missing `{text}` -> `{scope}` in {captures:#?}"
        );
    }

    #[test]
    fn test_can_load_grammar() {
        let mut parser = Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Flux parser");
    }

    #[test]
    fn current_and_editor_superset_surface_parses_without_errors() {
        let code = r###"flow current(input: String) -> answer
  $prior: String = peek $input
  $field = $prior.value?
  $message = fmt("""value: {prior}
double: {{prior}}
shape: {text: string}""")
  $parsed = parse($message, as: "string")
  $ticket = thing ticket id "FLUX-42"
  $custom = thing custom "widget" key "w-1"
  $annotated = @ticket(id: "FLUX-43")
  $wire = @json {"kind":"lit","value":1}
  @effect(read)
  memo $cached: String = read("schema.sql")
  $context += $prior, $field
  repeat 2 -> $repeated
    poll()
  with_tools [read, grep] -> $scoped
    inspect()
  once "send" -> $receipt
    send($message)
  checkpoint "phase-1"
  await $event: Event = "github.push"
  try
    risky()
  catch $err
    recover($err)
  race 5000 -> $winner
    branch $fast
      fast()
  pipe -> $out
    read("input.txt")
    parse($prior, as: "string")
  scope $handle = acquire()
    use($handle)
  finally
    release($handle)
  saga
    step
      charge()
    undo
      refund()
  throttle "fetches" 5 per 60_000
    web_fetch("https://example.com")
  debounce "rebuild" 300
    build()
  verify check() contains "ok": "check failed"
  $multi = transform(
    $prior,
    schema: Result,
    payload: {
      item: $field,
      values: [
        1,
        -2,
      ],
    },
  )
  return $out

journey deliver
  agent helper
  flow
    return true

type Result
  value: String

flow legacy
  watch for: 1000, every: 100
    poll()
  block -> $result
    work()
  confirm "Proceed?", risk: high
  retry 3, backoff: exponential, delay: 500 -> $retried
    flaky()
  race timeout: 5000 -> $raced
    branch $candidate
      candidate()
"###;

        let tree = parse(code);
        assert!(
            !tree.root_node().has_error(),
            "unexpected parse errors:\n{}",
            tree.root_node().to_sexp()
        );
    }

    #[test]
    fn highlight_captures_follow_flux_semantic_roles() {
        let code = r#"flow sample(input: string, schema: Result) -> answer
  $time = now()
  $message = fmt("at {input}")
  $parsed = parse($message, as: "string")
  $ranked = ai.rank($parsed)
  $field = $ranked.value?
  $thing = thing ticket id "FLUX-42"
  $custom = thing custom "widget" key "w-1"
  $ticket = @ticket(id: "FLUX-42")
  $wire = @json {"kind":"lit","value":1}
  return {answer: $field}
"#;

        let captures = highlight_captures(code);
        for callable in ["sample", "now", "fmt", "parse", "ai", "rank"] {
            assert_capture(&captures, callable, "function");
        }
        for symbol in [
            "$time",
            "$message",
            "$parsed",
            "$ranked",
            "$ranked.value?",
            "$field",
            "{input}",
        ] {
            assert_capture(&captures, symbol, "variable");
        }
        assert_capture(&captures, "input", "variable.parameter");
        assert_capture(&captures, "schema", "variable.parameter");
        assert_capture(&captures, "string", "type");
        assert_capture(&captures, "Result", "type");
        assert_capture(&captures, "answer", "type");
        assert_capture(&captures, "ticket", "type");
        assert_capture(&captures, "custom", "type");
        assert_capture(&captures, "id", "keyword");
        assert_capture(&captures, "key", "keyword");
        assert_capture(&captures, r#"{"kind":"lit","value":1}"#, "string.special");
        assert_capture(&captures, "as", "variable.other.member");
        assert_capture(&captures, "answer", "variable.other.member");
        assert_capture(&captures, "@ticket", "attribute");
        assert_capture(&captures, "flow", "keyword");
        assert_capture(&captures, "return", "keyword");
        assert!(
            captures
                .iter()
                .all(|(_, scope)| scope != "function.builtin" && scope != "function.method"),
            "callables must not split across builtin/method scopes: {captures:#?}"
        );
    }

    #[test]
    fn recovered_invalid_text_is_highlighted_as_error() {
        let captures = highlight_captures("flow broken\n  € invalid\n");
        assert_capture(&captures, "€", "error");
    }
}
