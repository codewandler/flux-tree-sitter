; Flow/op/journey-wide bindings for the intentionally flat editor grammar. Fine-grained block scope
; would require an INDENT/DEDENT scanner; these captures still provide useful definition/reference
; information without pretending the flat CST models nested lexical scopes.

[
  (flow_declaration)
  (op_declaration)
  (journey_declaration)
] @local.scope

; Definitions
(parameter name: (identifier) @local.definition.variable.parameter)
(bind_statement target: (variable) @local.definition.variable)
(memo_statement target: (variable) @local.definition.variable)
(each_clause item: (variable) @local.definition.variable)
(each_clause collect: (variable) @local.definition.variable)
(repeat_clause bind: (variable) @local.definition.variable)
(branch_clause name: (variable) @local.definition.variable)
(ctx_clause name: (variable) @local.definition.variable)
(catch_clause error: (variable) @local.definition.variable)
(await_statement target: (variable) @local.definition.variable)
(scope_clause target: (variable) @local.definition.variable)
(fallback_clause bind: (variable) @local.definition.variable)
(loop_clause bind: (variable) @local.definition.variable)
(timeout_clause bind: (variable) @local.definition.variable)
(budget_clause bind: (variable) @local.definition.variable)
(with_tools_clause bind: (variable) @local.definition.variable)
(race_clause bind: (variable) @local.definition.variable)
(seq_clause bind: (variable) @local.definition.variable)
(block_clause bind: (variable) @local.definition.variable)
(pipe_clause bind: (variable) @local.definition.variable)
(retry_clause bind: (variable) @local.definition.variable)
(once_clause bind: (variable) @local.definition.variable)

; References. Definition captures on the same node take precedence in consumers that apply locals.
(variable) @local.reference
