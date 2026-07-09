; Flux-Lang highlight queries
; Capture names follow the Helix / nvim-treesitter conventions.

; ------------------------------------------------------------------ comments
(comment) @comment

; ------------------------------------------------------------------ keywords
[
  "flow"
  "op"
  "type"
] @keyword

(declaration_keyword) @keyword

[
  "when"
  "else"
  "unless"
  "match"
  "case"
  "default"
  "route"
  "fallback"
  "branch"
  "parallel"
  "seq"
] @keyword.control.conditional

[
  "each"
  "in"
  "repeat"
  "until"
  "loop"
  "for"
  "every"
  "flat"
] @keyword.control.repeat

"return" @keyword.control.return

[
  "do"
  "assert"
  "confirm"
  "goal"
  "with_tools"
  "ctx"
  "retry"
  "backoff"
  "delay"
  "timeout"
  "budget"
  "purpose"
  "include"
  "exclude"
  "risk"
  "secret"
] @keyword

; ------------------------------------------------------------------ annotations
(effect_annotation "@effect" @attribute)
(effect_annotation effect: (identifier) @attribute)
"@json" @attribute
(json_escape (json_content) @string.special)

; ------------------------------------------------------------------ declarations
(flow_declaration name: (identifier) @function)
(op_declaration name: (identifier) @function)
(agent_declaration name: (identifier) @namespace)
(channel_declaration name: (identifier) @namespace)
(datasource_declaration name: (identifier) @namespace)
(trigger_declaration name: (identifier) @namespace)
(journey_declaration name: (identifier) @namespace)

; ------------------------------------------------------------------ parameters & keys
(parameter name: (identifier) @variable.parameter)
(named_argument name: (identifier) @variable.parameter)
(attribute key: (attribute_key) @property)
(pair key: (identifier) @property)

; ------------------------------------------------------------------ calls
(operation (identifier) @function.method)
"fmt" @function.builtin

; ------------------------------------------------------------------ variables
(variable) @variable
(variable field: (property) @variable.other.member)

; ------------------------------------------------------------------ types
(builtin_type) @type.builtin
(type_identifier) @type

; ------------------------------------------------------------------ enum labels
(union_variant name: (identifier) @constant)

; ------------------------------------------------------------------ literals
(string) @string
(triple_string) @string
(escape_sequence) @constant.character.escape
(interpolation) @punctuation.special
(interpolation (interp_symbol) @variable)
(number) @constant.numeric
(boolean) @constant.builtin.boolean
(null) @constant.builtin

; ------------------------------------------------------------------ operators & punctuation
[
  "="
  "+="
  "->"
  "|"
  "=="
  "!="
  "<"
  "<="
  ">"
  ">="
  "&&"
  "||"
  "!"
  "*"
  "/"
  "+"
  "-"
] @operator

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  ","
  ":"
  "."
] @punctuation.delimiter
