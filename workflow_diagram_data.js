// Graph data for the Security Alert Analysis React Flow diagram.
// label = human-readable title, sub = technical step id, kind = step type,
// phase = grouping band. x/y position nodes on the canvas (top-down flow).

window.WF = (function () {
  var C = { x: 480 };
  var G = 168; // vertical gap between stacked steps

  var P = {
    setup: 'Setup \u00b7 load config',
    guard: 'Per-alert guards',
    enrich: 'Gather evidence',
    reason: 'AI reasoning',
    act: 'Record & act',
  };

  var nodes = [
    { id: 'trigger', phase: P.setup, type: 'start', label: 'A security alert fires', sub: 'trigger', kind: 'triggers: [alert]', x: C.x, y: 0,
      what: 'The workflow starts whenever one or more security alerts are raised. Each run receives the batch of alerts and their rule context.',
      why: 'Event-driven triage: alerts are analysed the instant they appear, with no polling or manual kickoff.',
      io: { in: ['event.alerts[]', 'event.rule.id'], out: ['per-alert loop items'] }, tags: ['entrypoint'] },

    { id: 'set_workflow_variables', phase: P.setup, type: 'data', label: 'Prepare workflow variables', sub: 'set_workflow_variables', kind: 'data.set', x: C.x, y: G,
      what: 'Derives a normalised version string (lowercased, spaces to underscores) and seeds a running-note flag reused throughout the run.',
      why: 'Establishing deterministic values up front keeps version tags consistent no matter which alert is processed.',
      io: { in: ['consts.workflow_version'], out: ['normalized_version', 'running_note'] }, tags: ['setup'] },

    { id: 'fetch_runtime_config', phase: P.setup, type: 'http', label: 'Load this space\u2019s settings', sub: 'fetch_runtime_config', kind: 'kibana.request \u00b7 GET', x: C.x, y: G * 2,
      what: 'Reads the space\u2019s live configuration \u2014 enabled flag, connector, agent, tag prefix, auto-close thresholds, conversation setting \u2014 from the internal Security Solution route.',
      why: 'Installed once globally but configured per space at run time, so one install serves every space with live, independently tunable settings. (This is the step whose base-URL routing caused the earlier 404.)',
      io: { in: ['GET /s/{spaceId}/internal/\u2026/runtime_config'], out: ['workflowEnabled', 'connectorId', 'agentId', 'tagPrefix', 'autoClose\u2026', 'createConversation'] }, tags: ['config', 'per-space', 'retry \u00d73'] },

    { id: 'set_runtime_config_variables', phase: P.setup, type: 'data', label: 'Apply the loaded settings', sub: 'set_runtime_config_variables', kind: 'data.set', x: C.x, y: G * 3,
      what: 'Copies the fetched config into cleanly typed variables (booleans and numbers vs strings).',
      why: 'Correct typing means later decisions \u2014 enabled? connector set? within thresholds? \u2014 evaluate reliably.',
      io: { in: ['fetch_runtime_config.output.*'], out: ['workflow_enabled', 'connector_id', 'agent_id', 'create_conversation', 'auto_close_*', 'tag_prefix'] }, tags: ['config', 'typing'] },

    { id: 'loop_gate', phase: P.guard, type: 'flow', label: 'For each alert \u2014 is triage on?', sub: 'loop_over_results', kind: 'foreach + if', x: C.x, y: G * 4,
      what: 'Loops over every alert in the batch. The body runs only when the workflow is enabled AND a connector is configured for this space.',
      why: 'A disabled or unconfigured space safely does nothing \u2014 enabled-by-default with an empty connector never performs work.',
      io: { in: ['event.alerts', 'workflow_enabled', 'connector_id'], out: ['branch: run | skip'] }, tags: ['gate', 'loop'] },

    { id: 'log_alert_link', phase: P.guard, type: 'log', label: 'Log a link to the alert', sub: 'log_alert_link', kind: 'console', x: C.x, y: G * 5,
      what: 'Writes a deep link to the alert being processed.',
      why: 'Lets an operator jump straight from the execution log to the exact alert under triage.',
      io: { in: ['foreach.item._id'], out: ['log line'] }, tags: ['observability'] },

    { id: 'dedup_gate', phase: P.guard, type: 'flow', label: 'Already analysed before?', sub: 'already_analyzed', kind: 'data.set \u00d72 + if \u00b7 tag present', x: C.x, y: G * 6,
      what: 'Two data.set steps (build_already_analyzed_expr, build_already_analyzed_condition) build a tag-match expression, then the gate checks whether the alert already carries the workflow tag prefix. If it does (and re-evaluation is off) it skips; otherwise it proceeds to full analysis.',
      why: 'Idempotency and cost control \u2014 avoids repeat LLM calls and duplicate notes on alerts that already have a verdict.',
      io: { in: ['alert.workflow_tags', 'tag_prefix', 'override_previous'], out: ['branch: skip | analyse'] }, tags: ['gate', 'idempotency'] },

    { id: 'skip', phase: P.guard, type: 'end', label: 'Skip \u2014 already done', sub: 'log_already_analyzed', kind: 'console', x: C.x + 340, y: G * 6,
      what: 'Logs that the alert was already analysed and how to re-run it (remove the tag), then moves on.',
      why: 'A transparent no-op so operators understand why nothing changed.',
      io: { in: ['tag_prefix'], out: ['log line'] }, tags: ['skip-path'] },

    { id: 'note_started', phase: P.enrich, type: 'http', label: 'Post \u201cAnalysis started\u201d note', sub: 'add_execution_started_note_to_alert', kind: 'kibana.request \u00b7 PATCH', x: C.x, y: G * 7,
      what: 'Adds a timeline note marking that automated triage has begun, linked to this execution, and saves the note id.',
      why: 'Gives analysts instant in-context feedback and creates the note that is later updated in place with the verdict.',
      io: { in: ['foreach.item._id', 'execution.url'], out: ['note_id'] }, tags: ['timeline', 'retry \u00d73'] },

    // enrichment fan-out (evenly spaced)
    { id: 'enrich_close', phase: P.enrich, type: 'es', label: 'How often is this rule closed?', sub: 'get_close_history', kind: 'search + ES|QL', x: C.x - 560, y: G * 8.1,
      what: 'Three queries over a 30-day lookback: total closed alerts for this rule, how many were false positives, and a breakdown of close reasons.',
      why: 'A rule habitually closed as a false positive is a strong prior that this alert is noise too.',
      io: { in: ['event.rule.id', 'alert @timestamp'], out: ['total_closed_alerts', 'false_positive_count', 'close_reasons_summary'] }, tags: ['enrichment', 'historical'] },

    { id: 'enrich_prev', phase: P.enrich, type: 'es', label: 'How widespread right now? (\u00b124h)', sub: 'get_global_prevalence', kind: 'search \u00b7 cardinality', x: C.x - 280, y: G * 8.1,
      what: 'Counts unique sources and actors for the rule within \u00b124h, using vendor-agnostic runtime fields spanning host, cloud account, IP and cloud identities.',
      why: 'Widespread firing hints at a campaign or a noisy rule; runtime fields work even for cloud fields not in the mapping.',
      io: { in: ['event.rule.id', '\u00b124h'], out: ['total_alerts', 'unique_sources', 'unique_actors', 'top_sources'] }, tags: ['enrichment', 'prevalence'] },

    { id: 'enrich_noise', phase: P.enrich, type: 'es', label: 'Sustained or a spike? (\u00b17d)', sub: 'get_noise_signal', kind: 'search \u00b7 cardinality', x: C.x, y: G * 8.1,
      what: 'The same cardinality measure over a wider \u00b17-day window.',
      why: 'A longer window separates a one-off spike from sustained, widespread activity.',
      io: { in: ['event.rule.id', '\u00b17d'], out: ['noise_signal_* stats'] }, tags: ['enrichment', 'prevalence'] },

    { id: 'enrich_rule', phase: P.enrich, type: 'es', label: 'What does the rule detect?', sub: 'get_rule_metadata', kind: 'search + foreach', x: C.x + 280, y: G * 8.1,
      what: 'Pulls the latest rule name, description, severity, type, references and MITRE mapping, flattened into readable Tactic \u203a Technique lines.',
      why: 'Grounds the AI in what the rule is designed to catch and how it maps to adversary techniques.',
      io: { in: ['event.rule.id'], out: ['metadata{}', 'threat_technique_lines[]'] }, tags: ['enrichment', 'MITRE'] },

    { id: 'enrich_graph', phase: P.enrich, type: 'sec', label: 'Find related alerts', sub: 'get_related_alerts', kind: 'security.buildAlertEntityGraph', x: C.x + 560, y: G * 8.1,
      what: 'Builds a scored graph of alerts sharing entities (process, host, user, IP, cloud identity), chaining transitively and weighting edges by field specificity.',
      why: 'Corroborating alerts turn an isolated signal into a coherent attack chain \u2014 one of the strongest true-positive indicators.',
      io: { in: ['seed alert', 'entity_fields[]'], out: ['alerts[]', 'stats.nodes/edges'] }, tags: ['enrichment', 'correlation'] },

    { id: 'observable', phase: P.enrich, type: 'data', label: 'Extract the key evidence', sub: 'build_alert_observable_context', kind: 'data.set \u00b7 Liquid', x: C.x, y: G * 9.2,
      what: 'Pulls the most discriminating fields (event, actor, host, process, file, network, cloud) into a compact block, skipping blanks.',
      why: 'This is the ground truth of what happened, kept separate from rule intent so the AI reasons from facts first.',
      io: { in: ['raw alert'], out: ['alert_observable_context'] }, tags: ['ground-truth', 'prompt'] },

    { id: 'timelines', phase: P.enrich, type: 'sec', label: 'Summarise alerts as narratives', sub: 'build_related_alert_lines', kind: 'foreach + renderAlertNarrative', x: C.x, y: G * 10.2,
      what: 'Renders short human-readable narratives for the seed alert and each related alert.',
      why: 'Token-efficient, scannable summaries keep the AI prompt focused.',
      io: { in: ['seed + related alerts'], out: ['related_alert_lines[]', 'attachment_label'] }, tags: ['prompt'] },

    { id: 'build_prompt', phase: P.reason, type: 'data', label: 'Assemble the analyst prompt', sub: 'build_agent_message', kind: 'data.set \u00b7 rubric', x: C.x, y: G * 11.2,
      what: 'Builds the full prompt: analyst role, a confidence-tier rubric, verdict semantics, a step-by-step reasoning process with decision gates, and every enrichment section.',
      why: 'The brain of the workflow \u2014 the structured rubric and gates make verdicts consistent, defensible and evidence-grounded.',
      io: { in: ['all enrichment outputs'], out: ['message'] }, tags: ['prompt', 'reasoning'] },

    { id: 'minimal_alert', phase: P.reason, type: 'data', label: 'Trim the alert for the model', sub: 'build_minimal_alert', kind: 'data.set \u00b7 pick', x: C.x, y: G * 12.2,
      what: 'Filters the raw alert down to the curated high-signal fields in consts.model_alert_fields using the pick filter, preserving value types and dropping the rest of the noisy _source.',
      why: 'A compact, curated attachment keeps token cost down and stops irrelevant _source noise from distracting the model.',
      io: { in: ['foreach.item', 'consts.model_alert_fields'], out: ['minimal_alert'] }, tags: ['prompt', 'token-efficiency'] },

    { id: 'agent', phase: P.reason, type: 'ai', label: 'Ask the AI to classify', sub: 'runAgent_step', kind: 'ai.agent \u00b7 configured agent', x: C.x, y: G * 13.2,
      what: 'Invokes the space\u2019s configured AI agent (agent_id + connector_id) with the prompt and the trimmed alert attached, optionally creating a conversation, requiring structured JSON: classification, confidence, rationale and contributing factors.',
      why: 'The classification engine. The enforced output schema yields a machine-usable verdict the rest of the flow can act on.',
      io: { in: ['prompt', 'agent_id', 'connector_id', 'create_conversation', 'minimal alert attachment'], out: ['classification', 'confidence_score', 'rationale', 'contributing_factors'] }, tags: ['AI', 'classification', 'retry \u00d73'] },

    { id: 'output_guard', phase: P.reason, type: 'flow', label: 'Did the AI return a verdict?', sub: 'check_if_output_exists', kind: 'if', x: C.x, y: G * 14.2,
      what: 'Branches on whether the agent actually produced a classification.',
      why: 'Fail-safe: an empty or malformed response becomes a visible error, never a silent wrong verdict.',
      io: { in: ['structured_output.classification'], out: ['branch: error | verdict'] }, tags: ['gate', 'safety'] },

    { id: 'error_note', phase: P.reason, type: 'end', label: 'Post error \u2014 no verdict', sub: 'add_no_data_note_to_alert', kind: 'kibana.request \u00b7 PATCH', x: C.x + 360, y: G * 14.2,
      what: 'Updates the note with a \u201cNo classification returned\u201d error and stops processing this alert.',
      why: 'Surfaces failures instead of hiding them.',
      io: { in: ['note_id'], out: ['error note'] }, tags: ['error-path'] },

    { id: 'verdict_note', phase: P.act, type: 'http', label: 'Write the verdict to the timeline', sub: 'add_verdict_note_to_alert', kind: 'kibana.request \u00b7 PATCH', x: C.x, y: G * 15.2,
      what: 'Updates the note in place with the full verdict: classification, confidence, rationale, contributing factors, analysis details, token usage, timestamp and a link to continue the conversation.',
      why: 'Delivers the analysis to where analysts work \u2014 the alert timeline \u2014 as a readable, auditable record.',
      io: { in: ['note_id', 'classification', 'confidence_score', 'rationale'], out: ['updated note'] }, tags: ['timeline', 'retry \u00d73'] },

    { id: 'tags', phase: P.act, type: 'sec', label: 'Tag the alert with the result', sub: 'apply workflow tags', kind: 'data.set + SetAlertTags', x: C.x, y: G * 16.2,
      what: 'Computes the tag set (prefix, version, classification, confidence), removes any stale prior workflow tags, then adds the fresh ones.',
      why: 'Tags make verdicts filterable and power the \u201calready analysed\u201d check on future runs.',
      io: { in: ['tag_prefix', 'normalized_version', 'classification', 'confidence_score'], out: ['workflow_tags updated'] }, tags: ['tagging', 'retry \u00d73'] },

    { id: 'autoclose_gate', phase: P.act, type: 'flow', label: 'Safe to auto-close?', sub: 'check_auto_close_conditions', kind: 'if \u00b7 FP + confidence band', x: C.x, y: G * 17.2,
      what: 'Proceeds only when auto-close is enabled, the verdict is false positive, and confidence sits within the configured min/max band.',
      why: 'The guardrail so automation only retires confident false positives \u2014 never true threats or borderline cases.',
      io: { in: ['auto_close_enabled', 'classification', 'confidence_score', 'thresholds'], out: ['branch: close | keep open'] }, tags: ['gate', 'guardrail'] },

    { id: 'close', phase: P.act, type: 'sec', label: 'Auto-close as false positive', sub: 'close_alert_as_false_positive', kind: 'SetAlertTags + SetAlertsStatus', x: C.x - 340, y: G * 18.2,
      what: 'Adds a \u201cclosed\u201d tag so the action is identifiable, then sets the alert status to closed with reason false_positive.',
      why: 'Closes the loop end to end: high-confidence noise is retired automatically, transparently and reversibly.',
      io: { in: ['foreach.item._id', 'closed_tag_suffix'], out: ['alert closed'] }, tags: ['auto-close', 'retry \u00d73'] },

    { id: 'done', phase: P.act, type: 'end', label: 'On to the next alert', sub: 'loop continues', kind: 'end of iteration', x: C.x, y: G * 18.2,
      what: 'Processing for this alert finishes and the loop continues with the next one.',
      why: 'Each alert in the batch is triaged independently.',
      io: { in: [], out: [] }, tags: ['exit'] },
  ];

  var e = function (s, t, opts) { return Object.assign({ id: s + '->' + t, source: s, target: t }, opts || {}); };

  var edges = [
    e('trigger', 'set_workflow_variables', { animated: true }),
    e('set_workflow_variables', 'fetch_runtime_config', { animated: true }),
    e('fetch_runtime_config', 'set_runtime_config_variables', { animated: true }),
    e('set_runtime_config_variables', 'loop_gate', { animated: true }),
    e('loop_gate', 'log_alert_link', { label: 'enabled', kind: 'ok' }),
    e('loop_gate', 'done', { label: 'off / no connector', kind: 'skip' }),
    e('log_alert_link', 'dedup_gate'),
    e('dedup_gate', 'skip', { label: 'already analysed', kind: 'skip' }),
    e('dedup_gate', 'note_started', { label: 'analyse', kind: 'ok' }),
    e('skip', 'done', { kind: 'skip' }),
    e('note_started', 'enrich_close', { kind: 'fan' }),
    e('note_started', 'enrich_prev', { kind: 'fan' }),
    e('note_started', 'enrich_noise', { kind: 'fan' }),
    e('note_started', 'enrich_rule', { kind: 'fan' }),
    e('note_started', 'enrich_graph', { kind: 'fan' }),
    e('enrich_close', 'observable', { kind: 'fan' }),
    e('enrich_prev', 'observable', { kind: 'fan' }),
    e('enrich_noise', 'observable', { kind: 'fan' }),
    e('enrich_rule', 'observable', { kind: 'fan' }),
    e('enrich_graph', 'observable', { kind: 'fan' }),
    e('observable', 'timelines', { animated: true }),
    e('timelines', 'build_prompt', { animated: true }),
    e('build_prompt', 'minimal_alert', { animated: true }),
    e('minimal_alert', 'agent', { animated: true }),
    e('agent', 'output_guard', { animated: true }),
    e('output_guard', 'error_note', { label: 'no verdict', kind: 'error' }),
    e('output_guard', 'verdict_note', { label: 'verdict', kind: 'ok' }),
    e('error_note', 'done', { kind: 'error' }),
    e('verdict_note', 'tags', { animated: true }),
    e('tags', 'autoclose_gate', { animated: true }),
    e('autoclose_gate', 'close', { label: 'FP in band', kind: 'ok' }),
    e('autoclose_gate', 'done', { label: 'keep open', kind: 'skip' }),
    e('close', 'done', { kind: 'ok' }),
  ];

  return { nodes: nodes, edges: edges, phases: [P.setup, P.guard, P.enrich, P.reason, P.act] };
})();
