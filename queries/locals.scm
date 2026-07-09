; Scopes and symbol bindings for scope-aware highlighting.

(flow_declaration) @local.scope
(op_declaration) @local.scope

; Definitions
(parameter name: (identifier) @local.definition.parameter)
(bind_statement target: (variable) @local.definition.var)
(each_clause item: (variable) @local.definition.var)
(each_clause collect: (variable) @local.definition.var)
(branch_clause name: (variable) @local.definition.var)
(ctx_clause name: (variable) @local.definition.var)

; References
(variable) @local.reference
