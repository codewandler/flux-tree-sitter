; Flux-Lang highlight queries.
; Capture semantic roles, not host-catalog knowledge: every callable is a function, regardless of
; whether it is built in, supplied by a plugin, or declared as a composite op.

; ------------------------------------------------------------------ comments
(comment) @comment

; ------------------------------------------------------------------ keywords
[
  "flow"
  "op"
  "type"
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
  "race"
  "seq"
  "block"
  "pipe"
  "each"
  "in"
  "repeat"
  "until"
  "loop"
  "watch"
  "for"
  "every"
  "flat"
  "return"
  "do"
  "assert"
  "verify"
  "contains"
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
  "memo"
  "once"
  "checkpoint"
  "await"
  "throttle"
  "per"
  "debounce"
  "try"
  "catch"
  "scope"
  "finally"
  "saga"
  "step"
  "undo"
  "peek"
  "thing"
] @keyword

(declaration_keyword) @keyword

; ------------------------------------------------------------------ annotations
(effect_annotation "@effect" @attribute)
(effect_annotation effect: (identifier) @attribute)
"@json" @attribute
(annotation) @attribute
(json_escape (json_content) @string.special)
(json_expression (json_content) @string.special)

; ------------------------------------------------------------------ declarations
(flow_declaration name: (identifier) @function)
(op_declaration name: (identifier) @function)
(agent_declaration name: (identifier) @namespace)
(channel_declaration name: (identifier) @namespace)
(datasource_declaration name: (identifier) @namespace)
(trigger_declaration name: (identifier) @namespace)
(journey_declaration name: (identifier) @namespace)
(type_declaration name: (type_identifier) @type)

; ------------------------------------------------------------------ calls
(operation (identifier) @function)
(fmt "fmt" @function)
(parse "parse" @function)

; ------------------------------------------------------------------ variables
(parameter name: (identifier) @variable.parameter)
(variable) @variable
(interpolation) @variable

; ------------------------------------------------------------------ types
(builtin_type) @type
(type_identifier) @type
(return_type type: (identifier) @type)
(parameter type: (identifier) @type)
(bind_statement type: (identifier) @type)
(memo_statement type: (identifier) @type)
(await_statement type: (identifier) @type)
(record_field type: (identifier) @type)
(generic_type (identifier) @type)
(optional_type (identifier) @type)

; ------------------------------------------------------------------ enum labels
(union_variant name: (identifier) @constant)

; ------------------------------------------------------------------ literals
(string) @string
(triple_string) @string
(escape_sequence) @constant.character.escape
(number) @constant.numeric
(boolean) @constant.builtin.boolean
(null) @constant.builtin

; ------------------------------------------------------------------ keys and labels
(named_argument name: (identifier) @variable.other.member)
(attribute key: (attribute_key) @variable.other.member)
(pair key: (_) @variable.other.member)
(record_field name: (identifier) @variable.other.member)

; `thing <kind> <selector> ...`: the form marker and selector are keywords; the referenced kind is
; type-like. `custom` is represented as an anonymous token, so capture the whole field either way.
(thing kind: (_) @type)
(thing kind: "custom" @type)
(thing selector: (identifier) @keyword)

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

"?" @punctuation.special

(ERROR) @error
