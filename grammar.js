/**
 * @file Flux-Lang grammar for tree-sitter
 * @author codewandler
 * @license MIT OR Apache-2.0
 *
 * Flux-Lang (`.flux`) is the human-writable text form of a flux execution graph.
 * See codewandler/flux (docs/syntax.md) for the language reference.
 *
 * Design note — this grammar is deliberately line-oriented. Top-level declarations
 * (`flow`/`op`/`agent`/`channel`/`datasource`/`trigger`/`journey`/`type`) own their
 * body: the run of statements/attributes up to the next top-level keyword, so
 * declarations fold and scope correctly. Bodies are flat *within* a declaration (a
 * `when` header and the lines beneath it are siblings). The grammar tracks no
 * indentation — which keeps it robust for highlighting rather than modelling every
 * nesting level, matching the upstream TextMate/IntelliJ tooling. It highlights the
 * *superset* the editor tooling recognises (includes aspirational nodes such as
 * `type`/`pipe`/`race`/`try`/`await`), not only the stricter runtime-parsed subset.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const BUILTIN_TYPES = ['String', 'Number', 'Bool', 'Any', 'List', 'Ctx'];

// reserved words that also legitimately appear as attribute keys (trigger `agent triage`).
// NB: `budget` stays out — `budget N` is always the budget_clause keyword form.
const ATTR_KEYWORDS = ['agent'];

module.exports = grammar({
  name: 'flux',

  word: $ => $.identifier,

  externals: $ => [$._line_start],

  extras: $ => [/[ \t]+/, $.comment],

  rules: {
    // Leading blank lines, then declarations. A declaration body absorbs its own
    // trailing blank/comment lines, so the top level never competes for a `_newline`.
    source_file: $ => seq(repeat($._newline), repeat($._declaration)),

    _newline: _ => token(/\r?\n/),
    comment: _ => token(seq('#', /[^\n]*/)),

    // ----------------------------------------------------------------- declarations

    _declaration: $ => choice(
      $.flow_declaration,
      $.op_declaration,
      $.agent_declaration,
      $.channel_declaration,
      $.datasource_declaration,
      $.trigger_declaration,
      $.journey_declaration,
      $.type_declaration,
    ),

    flow_declaration: $ => seq(
      $._line_start,
      'flow',
      field('name', $.identifier),
      optional(field('parameters', $.parameter_list)),
      optional($.return_type),
      $._newline,
      repeat($._body_line),
    ),

    op_declaration: $ => seq(
      $._line_start,
      'op',
      field('name', $.identifier),
      optional(field('parameters', $.parameter_list)),
      optional($.return_type),
      $._newline,
      repeat($._body_line),
    ),

    _body_line: $ => choice($.attribute, $._statement, $._newline),

    agent_declaration: $ => declBlock('agent', $),
    channel_declaration: $ => declBlock('channel', $),
    datasource_declaration: $ => declBlock('datasource', $),
    trigger_declaration: $ => declBlock('trigger', $),
    journey_declaration: $ => declBlock('journey', $),

    // decl / op-metadata attribute line: `key value`, `key "s"`, `key [a,b]`, `key secret "ENV"`
    attribute: $ => seq(
      field('key', $.attribute_key),
      field('value', $._value),
      $._newline,
    ),
    // Use the reserved-word-aware `identifier` so a body never lexes the next
    // `flow`/`op`/… declaration keyword as an attribute key. `agent` is a real
    // attribute key (trigger `agent triage`) yet also reserved, so admit it explicitly.
    attribute_key: $ => choice($.identifier, ...ATTR_KEYWORDS),

    type_declaration: $ => seq(
      $._line_start,
      'type',
      field('name', $.type_identifier),
      $._newline,
      repeat(choice($.record_field, $.union_variant, $._newline)),
    ),
    record_field: $ => seq(field('name', $.identifier), ':', field('type', $._type), $._newline),
    union_variant: $ => seq('|', field('name', $.identifier), $._newline),

    // ----------------------------------------------------------------- signatures

    parameter_list: $ => seq('(', commaSep($.parameter), ')'),
    parameter: $ => seq(field('name', $.identifier), optional(seq(':', field('type', $._type)))),
    return_type: $ => seq('->', field('type', $._type)),

    _type: $ => choice($.generic_type, $.optional_type, $.builtin_type, $.type_identifier),
    optional_type: $ => prec(1, seq(choice($.builtin_type, $.type_identifier, $.generic_type), '?')),
    generic_type: $ => seq(choice($.builtin_type, $.type_identifier), '<', commaSep1($._type), '>'),
    builtin_type: _ => choice(...BUILTIN_TYPES),
    type_identifier: _ => token(/[A-Z][A-Za-z0-9_]*/),

    // ----------------------------------------------------------------- statements

    _statement: $ => choice(
      $.bind_statement,
      $.do_statement,
      $.return_statement,
      $.assert_statement,
      $.when_clause,
      $.else_clause,
      $.unless_clause,
      $.each_clause,
      $.repeat_clause,
      $.until_clause,
      $.loop_clause,
      $.timeout_clause,
      $.budget_clause,
      $.match_clause,
      $.route_clause,
      $.case_clause,
      $.default_clause,
      $.fallback_clause,
      $.branch_clause,
      $.parallel_clause,
      $.seq_clause,
      $.retry_clause,
      $.with_tools_clause,
      $.ctx_clause,
      $.context_attribute,
      $.confirm_clause,
      $.goal,
      $.json_escape,
      $.expression_statement,
    ),

    bind_statement: $ => seq(
      optional($.effect_annotation),
      field('target', $.variable),
      field('operator', choice('=', '+=')),
      field('value', $._expression),
      $._newline,
    ),
    effect_annotation: $ => seq('@effect', '(', field('effect', $.identifier), ')', optional($._newline)),

    // `do <op> <args>` — the effectful-call marker takes BARE arguments (no parens):
    // `do notify "up"`, `do observe "turn.gather", $ran`, `do assign {a: 1, confirm: true}`.
    do_statement: $ => seq('do', field('operation', $.operation), optional(field('arguments', $.arguments)), $._newline),
    return_statement: $ => seq('return', optional(field('value', $._expression)), $._newline),
    assert_statement: $ => seq('assert', field('condition', $._expression), optional(seq(',', field('message', $.string))), $._newline),

    when_clause: $ => seq('when', field('condition', $._expression), $._newline),
    else_clause: $ => seq('else', $._newline),
    unless_clause: $ => seq('unless', field('condition', $._expression), $._newline),

    each_clause: $ => seq(
      'each', field('item', $.variable), 'in', field('list', $._expression),
      optional(seq('->', optional('flat'), field('collect', $.variable))),
      $._newline,
    ),

    repeat_clause: $ => seq('repeat', field('count', $._expression), $._newline),
    until_clause: $ => seq('until', field('condition', $._expression), $._newline),

    loop_clause: $ => seq('loop', 'for', field('for_ms', $._expression), optional(seq('every', field('every_ms', $._expression))), optional($._arrow_bind), $._newline),
    timeout_clause: $ => seq('timeout', field('ms', $._expression), optional($._arrow_bind), $._newline),
    budget_clause: $ => seq('budget', field('limit', $._expression), optional($._arrow_bind), $._newline),

    match_clause: $ => seq('match', field('subject', $._expression), $._newline),
    route_clause: $ => seq('route', field('selector', $._expression), $._newline),
    case_clause: $ => seq('case', field('value', $._expression), $._newline),
    default_clause: $ => seq('default', $._newline),

    fallback_clause: $ => seq('fallback', optional($._arrow_bind), $._newline),
    branch_clause: $ => seq('branch', optional(field('name', $.variable)), $._newline),
    parallel_clause: $ => seq('parallel', $._newline),
    seq_clause: $ => seq('seq', optional($._arrow_bind), $._newline),

    retry_clause: $ => seq(
      'retry', field('max', $._expression),
      optional(seq('backoff', field('backoff', $.identifier))),
      optional(seq('delay', field('delay', $._expression))),
      optional($._arrow_bind),
      $._newline,
    ),

    with_tools_clause: $ => seq('with_tools', field('tools', $.array), $._newline),

    ctx_clause: $ => seq('ctx', field('name', $.variable), $._newline),
    // the indented lines of a `ctx` pack, appearing flat in the body
    context_attribute: $ => choice(
      seq('purpose', field('purpose', $.string), $._newline),
      seq(choice('include', 'exclude'), commaSep1($.variable), $._newline),
    ),

    confirm_clause: $ => seq('confirm', field('message', $.string), optional(seq(',', 'risk', ':', field('risk', $.identifier))), $._newline),
    goal: $ => seq('goal', field('text', $.string), $._newline),
    json_escape: $ => seq('@json', field('json', alias(token(/[^\n]+/), $.json_content)), $._newline),

    expression_statement: $ => seq($._expression, $._newline),

    _arrow_bind: $ => seq('->', field('bind', $.variable)),

    // ----------------------------------------------------------------- expressions

    _expression: $ => choice($.unary_expression, $.binary_expression, $._primary),

    _primary: $ => choice(
      $.call,
      $.fmt,
      $.variable,
      $.string,
      $.triple_string,
      $.number,
      $.boolean,
      $.null,
      $.array,
      $.object,
      $.builtin_type,
      $.type_identifier,
      $.identifier,
      $.parenthesized,
    ),

    parenthesized: $ => seq('(', $._expression, ')'),
    unary_expression: $ => prec(7, seq('!', $._expression)),

    binary_expression: $ => {
      /** @type {[number, RuleOrLiteral][]} */
      const table = [
        [6, choice('*', '/')],
        [5, choice('+', '-')],
        [4, choice('==', '!=', '<', '<=', '>', '>=')],
        [3, '&&'],
        [2, '||'],
      ];
      return choice(...table.map(([p, op]) => prec.left(p, seq(
        field('left', $._expression),
        field('operator', op),
        field('right', $._expression),
      ))));
    },

    fmt: $ => prec(2, seq('fmt', '(', field('template', $.string), ')')),
    call: $ => prec(1, seq(field('function', $.operation), $._call_tail)),
    _call_tail: $ => seq('(', optional($.arguments), ')'),
    arguments: $ => seq(commaSep1($._argument), optional(',')),
    _argument: $ => choice($.named_argument, $._expression),
    named_argument: $ => seq(field('name', $.identifier), ':', field('value', $._expression)),

    // op / composite-op name — may be dotted and/or hyphenated (`babelforce-manager.acd.create_queue`)
    operation: $ => prec.right(seq(
      $.identifier,
      repeat(seq(token.immediate(/[.\-]/), alias(token.immediate(/[A-Za-z0-9_]+/), $.identifier))),
    )),

    variable: $ => prec.right(seq(
      $._var_head,
      repeat(seq(token.immediate('.'), field('field', $.property))),
    )),
    _var_head: _ => token(seq('$', /[A-Za-z_][A-Za-z0-9_]*/)),
    property: _ => token.immediate(/[A-Za-z0-9_]+/),

    // ----------------------------------------------------------------- literals

    array: $ => seq('[', optional($.arguments), ']'),
    object: $ => seq('{', optional(seq(commaSep1($.pair), optional(','))), '}'),
    pair: $ => seq(field('key', choice($.identifier, $.string, $.number)), ':', field('value', $._expression)),

    string: $ => seq(
      '"',
      repeat(choice($.string_content, $.escape_sequence, $.interpolation)),
      token.immediate('"'),
    ),
    string_content: _ => token.immediate(prec(1, /[^"\\{]+/)),
    escape_sequence: _ => token.immediate(/\\./),

    triple_string: $ => seq(
      '"""',
      repeat(choice($.interpolation, $._triple_content)),
      '"""',
    ),
    _triple_content: _ => token.immediate(prec(1, /([^"{]|"[^"]|""[^"])+/)),

    interpolation: $ => seq(token.immediate('{'), optional(field('symbol', $.interp_symbol)), '}'),
    interp_symbol: _ => token.immediate(/[A-Za-z_][A-Za-z0-9_.]*/),

    number: _ => token(seq(optional('-'), /[0-9]+/, optional(seq('.', /[0-9]+/)))),
    boolean: _ => choice('true', 'false'),
    null: _ => 'null',

    // ----------------------------------------------------------------- decl values

    _value: $ => choice(
      $.secret_reference,
      $.string,
      $.triple_string,
      $.number,
      $.boolean,
      $.null,
      $.array,
      $.object,
      $.identifier,
    ),
    secret_reference: $ => seq('secret', field('env', $.string)),

    // kebab- and snake-case: flux names may contain internal hyphens
    // (`route-call`, `after-hours`, `provision-agent`).
    identifier: _ => token(/[a-z_][A-Za-z0-9_]*(-[A-Za-z0-9_]+)*/),
  },
});

/**
 * A `key name` header + a body of attributes/statements up to the next top-level decl.
 * @param {string} kw
 * @param {GrammarSymbols<string>} $
 */
function declBlock(kw, $) {
  return seq(
    $._line_start,
    field('kind', alias(kw, $.declaration_keyword)),
    field('name', $.identifier),
    $._newline,
    repeat(choice($.attribute, $._statement, $._newline)),
  );
}

/** @param {RuleOrLiteral} rule */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

/** @param {RuleOrLiteral} rule */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}
