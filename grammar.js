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
    journey_declaration: $ => seq(
      $._line_start,
      field('kind', alias('journey', $.declaration_keyword)),
      field('name', $.identifier),
      $._newline,
      repeat(choice($.journey_flow_marker, $.attribute, $._statement, $._newline)),
    ),

    // A journey embeds an anonymous flow below its optional `agent` attribute. Bodies remain flat
    // in this highlighting grammar, but the marker is structural (and highlighted), not a stray
    // expression statement.
    journey_flow_marker: $ => seq('flow', $._newline),

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

    parameter_list: $ => seq(
      '(',
      repeat($._newline),
      optional(seq(
        $.parameter,
        repeat(seq(',', repeat($._newline), $.parameter)),
        optional(','),
        repeat($._newline),
      )),
      ')',
    ),
    parameter: $ => seq(field('name', $.identifier), optional(seq(':', field('type', $._type)))),
    return_type: $ => seq('->', field('type', $._type)),

    _type: $ => choice($.generic_type, $.optional_type, $.builtin_type, $.type_identifier, $.identifier),
    optional_type: $ => prec(1, seq(choice($.builtin_type, $.type_identifier, $.identifier, $.generic_type), '?')),
    generic_type: $ => seq(
      choice($.builtin_type, $.type_identifier, $.identifier),
      '<',
      commaSep1($._type),
      '>',
    ),
    builtin_type: _ => choice(...BUILTIN_TYPES),
    type_identifier: _ => token(/[A-Z][A-Za-z0-9_]*/),

    // ----------------------------------------------------------------- statements

    _statement: $ => choice(
      $.ctx_append_statement,
      $.bind_statement,
      $.memo_statement,
      $.do_statement,
      $.return_statement,
      $.assert_statement,
      $.verify_statement,
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
      $.race_clause,
      $.seq_clause,
      $.block_clause,
      $.pipe_clause,
      $.retry_clause,
      $.with_tools_clause,
      $.ctx_clause,
      $.context_attribute,
      $.confirm_clause,
      $.once_clause,
      $.checkpoint_statement,
      $.await_statement,
      $.throttle_clause,
      $.debounce_clause,
      $.try_clause,
      $.catch_clause,
      $.scope_clause,
      $.finally_clause,
      $.saga_clause,
      $.step_clause,
      $.undo_clause,
      $.watch_clause,
      $.goal,
      $.json_escape,
      $.expression_statement,
    ),

    bind_statement: $ => seq(
      optional($.effect_annotation),
      field('target', $.variable),
      optional(seq(':', field('type', $._type))),
      field('operator', '='),
      field('value', $._expression),
      $._newline,
    ),
    ctx_append_statement: $ => seq(
      field('target', $.variable),
      '+=',
      optional(field('values', $.arguments)),
      $._newline,
    ),
    memo_statement: $ => seq(
      optional($.effect_annotation),
      'memo',
      field('target', $.variable),
      optional(seq(':', field('type', $._type))),
      '=',
      field('value', $._expression),
      $._newline,
    ),
    effect_annotation: $ => seq('@effect', '(', field('effect', $.identifier), ')', optional($._newline)),

    // `do <op> <args>` — the effectful-call marker takes BARE arguments (no parens):
    // `do notify "up"`, `do observe "turn.gather", $ran`, `do assign {a: 1, confirm: true}`.
    do_statement: $ => seq('do', field('operation', $.operation), optional(field('arguments', $.arguments)), $._newline),
    return_statement: $ => seq('return', optional(field('value', $._expression)), $._newline),
    assert_statement: $ => seq('assert', field('condition', $._expression), optional(seq(',', field('message', $.string))), $._newline),
    verify_statement: $ => seq(
      'verify',
      field('command', $._expression),
      'contains',
      field('expect', $._expression),
      optional(seq(':', field('message', $.string))),
      $._newline,
    ),

    when_clause: $ => seq('when', field('condition', $._expression), $._newline),
    else_clause: $ => seq('else', $._newline),
    unless_clause: $ => seq('unless', field('condition', $._expression), $._newline),

    each_clause: $ => seq(
      'each', field('item', $.variable), 'in', field('list', $._expression),
      optional(seq('->', optional('flat'), field('collect', $.variable))),
      $._newline,
    ),

    repeat_clause: $ => seq(
      'repeat', field('count', $._expression), optional($._arrow_bind), $._newline,
    ),
    until_clause: $ => seq('until', field('condition', $._expression), $._newline),

    loop_clause: $ => seq('loop', 'for', field('for_ms', $._expression), optional(seq('every', field('every_ms', $._expression))), optional($._arrow_bind), $._newline),
    watch_clause: $ => seq(
      'watch',
      'for', optional(':'), field('for_ms', $._expression), optional(','),
      optional(seq('every', optional(':'), field('every_ms', $._expression), optional(','))),
      optional($._arrow_bind),
      $._newline,
    ),
    timeout_clause: $ => seq('timeout', field('ms', $._expression), optional($._arrow_bind), $._newline),
    budget_clause: $ => seq('budget', field('limit', $._expression), optional($._arrow_bind), $._newline),

    match_clause: $ => seq('match', field('subject', $._expression), $._newline),
    route_clause: $ => seq('route', field('selector', $._expression), $._newline),
    case_clause: $ => seq('case', field('value', $._expression), $._newline),
    default_clause: $ => seq('default', $._newline),

    fallback_clause: $ => seq('fallback', optional($._arrow_bind), $._newline),
    branch_clause: $ => seq('branch', optional(field('name', $.variable)), $._newline),
    parallel_clause: $ => seq('parallel', $._newline),
    race_clause: $ => seq(
      'race',
      choice(
        field('timeout_ms', $._expression),
        seq('timeout', optional(':'), field('timeout_ms', $._expression)),
      ),
      optional($._arrow_bind),
      $._newline,
    ),
    seq_clause: $ => seq('seq', optional($._arrow_bind), $._newline),
    block_clause: $ => seq('block', optional($._arrow_bind), $._newline),
    pipe_clause: $ => seq('pipe', optional($._arrow_bind), $._newline),

    retry_clause: $ => seq(
      'retry', field('max', $._expression),
      optional(','),
      optional(seq('backoff', optional(':'), field('backoff', $.identifier), optional(','))),
      optional(seq('delay', optional(':'), field('delay', $._expression), optional(','))),
      optional($._arrow_bind),
      $._newline,
    ),

    with_tools_clause: $ => seq(
      'with_tools', field('tools', $.array), optional($._arrow_bind), $._newline,
    ),

    ctx_clause: $ => seq('ctx', field('name', $.variable), $._newline),
    // the indented lines of a `ctx` pack, appearing flat in the body
    context_attribute: $ => choice(
      seq('purpose', field('purpose', $.string), $._newline),
      seq(choice('include', 'exclude'), commaSep1($.variable), $._newline),
    ),

    confirm_clause: $ => seq(
      'confirm',
      field('message', $.string),
      optional(','),
      optional(seq('risk', optional(':'), field('risk', $.identifier))),
      $._newline,
    ),
    once_clause: $ => seq('once', field('label', $.string), optional($._arrow_bind), $._newline),
    checkpoint_statement: $ => seq('checkpoint', field('label', $.string), $._newline),
    await_statement: $ => seq(
      'await',
      optional(seq(
        field('target', $.variable),
        optional(seq(':', field('type', $._type))),
        '=',
      )),
      field('source', $.string),
      $._newline,
    ),
    throttle_clause: $ => seq(
      'throttle', field('name', $.string), field('max', $._expression),
      'per', field('window_ms', $._expression), $._newline,
    ),
    debounce_clause: $ => seq(
      'debounce', field('name', $.string), field('wait_ms', $._expression), $._newline,
    ),
    try_clause: $ => seq('try', $._newline),
    catch_clause: $ => seq('catch', optional(field('error', $.variable)), $._newline),
    scope_clause: $ => seq(
      'scope',
      optional(seq(field('target', $.variable), '=', field('acquire', $._expression))),
      $._newline,
    ),
    finally_clause: $ => seq('finally', $._newline),
    saga_clause: $ => seq('saga', $._newline),
    step_clause: $ => seq('step', $._newline),
    undo_clause: $ => seq('undo', $._newline),
    goal: $ => seq('goal', field('text', $.string), $._newline),
    json_escape: $ => prec(2, seq(
      '@json',
      field('json', $.json_content),
      $._newline,
    )),

    expression_statement: $ => seq($._expression, $._newline),

    _arrow_bind: $ => seq('->', field('bind', $.variable)),

    // ----------------------------------------------------------------- expressions

    _expression: $ => choice($.unary_expression, $.binary_expression, $._primary),

    _primary: $ => choice(
      $.call,
      $.fmt,
      $.parse,
      $.peek,
      $.thing,
      $.thing_annotation,
      $.json_expression,
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
    unary_expression: $ => prec(7, seq(choice('!', '-'), $._expression)),

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

    fmt: $ => prec(3, seq('fmt', '(', field('template', choice($.string, $.triple_string)), ')')),
    parse: $ => prec(3, seq('parse', $._call_tail)),
    peek: $ => prec(3, seq('peek', field('symbol', $.variable))),
    thing: $ => prec(3, seq(
      'thing',
      field('kind', choice('custom', $.identifier)),
      optional(field('custom_kind', $.string)),
      field('selector', $.identifier),
      field('value', choice($.string, $.number, $.identifier)),
    )),
    thing_annotation: $ => prec(3, seq(field('annotation', $.annotation), $._call_tail)),
    json_expression: $ => prec(1, seq(
      '@json',
      field('json', $.json_content),
    )),
    json_content: _ => token(/[^ \t\r\n][^\n]*/),
    call: $ => prec(1, seq(field('function', $.operation), $._call_tail)),
    _call_tail: $ => seq(
      '(',
      repeat($._newline),
      optional(seq(alias($._multiline_arguments, $.arguments), repeat($._newline))),
      ')',
    ),
    arguments: $ => seq(
      $._argument,
      repeat(seq(',', $._argument)),
      optional(','),
    ),
    _multiline_arguments: $ => seq($._argument, optional($._multiline_argument_tail)),
    _multiline_argument_tail: $ => prec.right(seq(
      ',',
      repeat($._newline),
      optional(seq($._argument, optional($._multiline_argument_tail))),
    )),
    _argument: $ => choice($.named_argument, $._expression),
    named_argument: $ => seq(field('name', $.identifier), ':', field('value', $._expression)),

    // op / composite-op name — may be dotted and/or hyphenated (`babelforce-manager.acd.create_queue`)
    operation: $ => prec.right(seq(
      $.identifier,
      repeat(seq(token.immediate(/[.\-]/), alias(token.immediate(/[A-Za-z0-9_]+/), $.identifier))),
    )),

    variable: $ => prec.right(seq(
      $._var_head,
      repeat(seq(token.immediate('.'), field('field', $.property), optional('?'))),
    )),
    _var_head: _ => token(seq('$', /[A-Za-z_][A-Za-z0-9_]*/)),
    property: _ => token.immediate(/[A-Za-z0-9_]+/),

    // ----------------------------------------------------------------- literals

    array: $ => seq(
      '[',
      repeat($._newline),
      optional(seq(alias($._multiline_arguments, $.arguments), repeat($._newline))),
      ']',
    ),
    object: $ => seq(
      '{',
      repeat($._newline),
      optional(seq(
        $.pair,
        repeat(seq(',', repeat($._newline), $.pair)),
        optional(','),
        repeat($._newline),
      )),
      '}',
    ),
    pair: $ => seq(field('key', choice($.identifier, $.string, $.number)), ':', field('value', $._expression)),

    string: $ => seq(
      '"',
      repeat(choice($.string_content, $.escape_sequence, $.interpolation, $.literal_brace)),
      token.immediate('"'),
    ),
    string_content: _ => token.immediate(prec(1, /[^"\\{}]+/)),
    escape_sequence: _ => token.immediate(/\\./),

    triple_string: $ => seq(
      '"""',
      repeat(choice($.interpolation, $._triple_content, $.literal_brace)),
      '"""',
    ),
    _triple_content: _ => token.immediate(prec(1, /([^"{}]|"[^"{}]|""[^"{}])+/)),

    interpolation: _ => token.immediate(choice(
      /\{\{[A-Za-z_][A-Za-z0-9_.]*\}\}/,
      /\{[A-Za-z_][A-Za-z0-9_.]*\}/,
    )),
    literal_brace: _ => token.immediate(/[{}]/),

    number: _ => token(seq(/[0-9][0-9_]*/, optional(seq('.', /[0-9]+/)))),
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
      $.type_identifier,
      $.identifier,
    ),
    secret_reference: $ => seq('secret', field('env', $.string)),

    annotation: _ => token(/@[A-Za-z_][A-Za-z0-9_]*/),

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
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}
