#include "tree_sitter/parser.h"

// A single zero-width external token: `_line_start`. It succeeds only at column 0
// on a line that begins with a lowercase letter — i.e. a top-level declaration
// keyword (`flow`/`op`/`agent`/`channel`/`datasource`/`trigger`/`journey`/`type`).
//
// This is the *only* indentation fact the grammar needs: it lets an indented body
// line (`agent triage` inside a trigger) be told apart from a new top-level
// declaration (`agent foo` at column 0) without a full INDENT/DEDENT scanner.
// The token is distinct from every body-line-start token, so the LR(1) table
// disambiguates "end this declaration, start a new one" from "continue the body"
// purely by lookahead — no GLR conflicts required.

enum TokenType {
  LINE_START,
};

void *tree_sitter_flux_external_scanner_create(void) { return NULL; }
void tree_sitter_flux_external_scanner_destroy(void *payload) { (void)payload; }
unsigned tree_sitter_flux_external_scanner_serialize(void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}
void tree_sitter_flux_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

bool tree_sitter_flux_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  (void)payload;
  if (!valid_symbols[LINE_START]) {
    return false;
  }
  int32_t c = lexer->lookahead;
  // Must begin with a lowercase declaration keyword, and sit at column 0 (no indent).
  if (c < 'a' || c > 'z') {
    return false;
  }
  if (lexer->get_column(lexer) != 0) {
    return false;
  }
  lexer->result_symbol = LINE_START; // zero-width: do not advance
  return true;
}
