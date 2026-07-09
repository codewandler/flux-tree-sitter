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
