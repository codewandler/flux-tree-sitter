# contact-centre.flux — IVR/ACD bootstrap showcase.

channel voice
  kind babelforce
  service_token secret "BABELFORCE_SERVICE_TOKEN"
  api_base "https://services.babelforce.com"

datasource cdr
  kind babelforce
  path "reporting/calls"

agent triage
  model "claude-sonnet-5"
  description "Classifies inbound caller utterances"
  tools ["acd.find_call", "reporting.list", "outbound.send_sms"]
  datasources [cdr]

trigger after-hours
  on "call.inbound.no_agents"
  run route-inbound
  agent triage

op provision-agent(name: String, email: String, group_id: String) -> Any
  description "Create a human ACD agent and slot it into a group"
  risk "medium"
  effects [network]
  expose true
  $agent = acd.create_agent({name: $name, email: $email, confirm: true})
  do acd.add_agent_to_group {agent_id: $agent.id, group_id: $group_id, confirm: true}
  return {id: $agent.id, email: $email}

flow bootstrap-contact-centre(inbound_number: String, welcome_wav_b64: String) -> Ctx
  goal "Stand up DE inbound support end-to-end."
  $me = identity.whoami({})
  assert $me.account_id, "manager is not bound to an account"

  parallel
    branch $hours
      $hours = ivr.set_business_hours({name: "DE office hours", timezone: "Europe/Berlin", confirm: true})
    branch $rec
      $rec = settings.set({section: "telephony/agent.recording", value: {enabled: true}, confirm: true})

  retry 3 backoff exponential delay 500 -> $prompt
    files.upload({name: "welcome-de", format: "wav", content_base64: $welcome_wav_b64, confirm: true})

  $menu = ivr.create_app({name: "DE Main Menu", module: "simpleMenu", config: {options: {"1": "sales"}}, confirm: true})
  do numbers.assign_to_app {number: $inbound_number, app_id: $menu.id, confirm: true}

  $group = acd.create_group({name: "Support DE", confirm: true})
  $roster = [{name: "Aneta K.", email: "aneta@acme.de"}, {name: "Ben R.", email: "ben@acme.de"}]
  each $person in $roster -> $agents
    provision-agent({name: $person.name, email: $person.email, group_id: $group.id})
  assert $agents, "no agents were provisioned"

  @effect(network)
  $note = fmt("provisioned {agents} into {group}")

  ctx $summary
    purpose "contact-centre bootstrap result"
    include $me, $menu, $agents
  return $summary

flow route-inbound(utterance: String, caller_id: String) -> String
  $live = acd.find_call({caller: $caller_id, queue: "Support DE"})
  route classify($utterance)
    case "sales"
      do outbound.send_sms {to: $caller_id, text: "A sales agent will call you back.", confirm: true}
      $answer = "routed to sales"
    case "cancel"
      when $live
        do acd.hangup_call {call_id: $live.id, confirm: true}
      $answer = "cancellation acknowledged"
    default
      $answer = "no match"
  return $answer
