# Dev/Engineering Models Design Spec

**Date:** 2026-04-02
**Status:** Draft

## Summary

Add 15 new systems-thinking models focused on development and engineering, plus updates to existing strategies and one new strategy. The models were filtered by a single criterion: does this genuinely shift perspective and surface hidden structure, or is it just a prescriptive practice dressed up as a lens? Practices (trunk-based dev, feature flags, chaos engineering, SOLID) were rejected. Decision frameworks, structural analysis tools, and paradigm lenses passed.

## Design Criteria

A model belongs in this project if it:
- Shifts perspective — looking through it reveals something you wouldn't see otherwise
- Surfaces hidden structure — not just recommends a practice
- Produces required_fields that capture analysis findings, not just checkboxes
- Creates productive tension with other models via counterbalances

Models that are prescriptive practices, checklists, or already covered by existing models were rejected.

## New Models

### Added to existing categories

#### architecture/state-ownership.yaml

- **Tags:** state, ownership, mutation, coupling, consistency
- **Description:** Who owns this state, and what happens when ownership is unclear? Shared mutable state is the most common source of subtle bugs. Trace where state lives, who reads it, who writes it, and what breaks when it's inconsistent.
- **Guiding questions:**
  - Where does mutable state live?
  - Who reads vs. writes it?
  - Is there a single source of truth or multiple copies?
  - What happens when copies diverge?
  - Where is state implicitly shared through globals, caches, or databases?
  - Could this state be derived instead of stored?
- **Required fields:**
  - `state_map` — Where state lives and who owns it
  - `shared_state_risks` — State accessed by multiple writers
  - `consistency_model` — How consistency is maintained (locks, events, eventual)
  - `derived_vs_stored` — State that could be computed instead of stored
- **Related:** coupling-cohesion (shared state is hidden coupling), error-propagation (inconsistent state causes downstream errors), feedback-loops (state changes can create reinforcing loops)
- **Counterbalance:** kiss — "Strict state ownership boundaries add indirection; is the isolation worth the complexity?"

#### architecture/error-propagation.yaml

- **Tags:** errors, propagation, cascade, handling, resilience
- **Description:** How do errors travel through the system? Where are they caught, transformed, swallowed, or amplified? Different from failure-modes (which asks what fails) — this traces the journey of a failure signal from origin to observable symptom.
- **Guiding questions:**
  - When an error occurs here, what does the caller see?
  - Where are errors swallowed silently?
  - Where do errors transform into something unintelligible?
  - Do errors cross boundaries with enough context to be actionable?
  - Where can a small error cascade into a large outage?
  - Are retry/fallback paths themselves error-prone?
- **Required fields:**
  - `error_paths` — How errors flow from origin to user
  - `swallowed_errors` — Where errors are caught and silently discarded
  - `error_transformation` — Where error context is lost or mangled
  - `cascade_risks` — Where a small error amplifies into a large one
- **Related:** failure-modes (what fails — this model traces where failure goes), blast-radius (error propagation determines blast radius), state-ownership (inconsistent state produces errors that propagate)
- **Counterbalance:** occams-razor — "Not every error path needs hardening; is the most likely failure mode actually this complex?"

#### architecture/contract-boundaries.yaml

- **Tags:** contracts, interfaces, API, assumptions, compatibility
- **Description:** What's actually promised at this interface, and what's merely assumed? Every boundary between components has an explicit contract (documented API) and an implicit contract (behavior callers depend on but nobody promised). When internals change, implicit contracts break.
- **Guiding questions:**
  - What does this interface explicitly promise?
  - What behavior do callers rely on that isn't documented?
  - What happens if the response format, ordering, or timing changes?
  - Where are internal implementation details leaking through the interface?
  - Are error contracts (what errors can be returned) well-defined?
  - Could this interface change without breaking consumers?
- **Required fields:**
  - `explicit_contracts` — Documented promises (API specs, schemas, SLAs)
  - `implicit_contracts` — Undocumented behavior callers depend on
  - `breaking_change_risk` — What internal changes would break consumers
  - `contract_enforcement` — How contracts are validated (types, tests, schemas, runtime checks)
- **Related:** coupling-cohesion (implicit contracts are hidden coupling), separation-of-concerns (good contracts enforce separation), trust-boundaries (contracts define what to trust across boundaries)
- **Counterbalance:** kiss — "Strict contract enforcement adds overhead; is the formality justified for internal interfaces?"

#### architecture/data-transformation-fidelity.yaml

- **Tags:** data, transformation, pipeline, integrity, mapping
- **Description:** Does data arrive intact after all transformations? Trace how data moves and transforms through a pipeline — where it's enriched, filtered, aggregated, serialized, or silently lost. Different from stock-and-flow (accumulation rates) — this is about whether transformations preserve meaning.
- **Guiding questions:**
  - What transformations does data undergo from source to destination?
  - Where could precision, context, or fields be silently lost?
  - Are transformations reversible or lossy?
  - Where are implicit type coercions or format conversions?
  - Do transformations compose correctly, or does order matter in subtle ways?
  - Where could encoding issues (unicode, timezone, null handling) corrupt data?
- **Required fields:**
  - `transformation_chain` — Ordered sequence of transformations from source to destination
  - `lossy_steps` — Where data is irreversibly reduced or dropped
  - `fidelity_risks` — Where meaning could be silently corrupted (coercions, truncation, encoding)
  - `round_trip_analysis` — Can data survive a round-trip through the pipeline intact?
- **Related:** state-ownership (who owns the canonical form of this data), contract-boundaries (each transformation step has input/output contracts), source-sink (data originates at sources and arrives at sinks)
- **Counterbalance:** occams-razor — "Not every pipeline needs formal schema validation at each step; where is corruption actually likely?"

#### reasoning/build-vs-buy.yaml

- **Tags:** decisions, cost, vendor, ownership, tradeoffs
- **Description:** What's the true total cost of building versus buying? Both paths have costs people systematically underestimate. Building underestimates maintenance, opportunity cost, and expertise required. Buying underestimates integration cost, vendor lock-in, and customization limits.
- **Guiding questions:**
  - What's the total cost of building, including maintenance for the next 3 years?
  - What's the total cost of buying, including integration and customization?
  - How core is this to our business — is it a differentiator or commodity?
  - What happens if the vendor goes away, raises prices, or pivots?
  - How much customization will we actually need?
  - Do we have the expertise to build and maintain this?
- **Required fields:**
  - `build_cost` — Realistic total cost including maintenance and opportunity cost
  - `buy_cost` — Realistic total cost including integration, customization, and lock-in
  - `core_vs_commodity` — Is this a differentiator worth investing in, or solved infrastructure?
  - `exit_cost` — What it costs to switch if we choose wrong
- **Related:** reversibility (how reversible is each path), dependency-risk (buying creates a dependency), margin-of-safety (budget margin for whichever path)
- **Counterbalance:** constraints — "Sometimes the binding constraint (time, money, expertise) makes the decision for you regardless of total-cost analysis"

#### reasoning/dependency-risk.yaml

- **Tags:** dependencies, supply-chain, risk, resilience, third-party
- **Description:** What happens when something you depend on breaks? Every dependency is a bet that the maintainer's priorities will continue to align with yours. Analyze your dependency chain for single points of failure, abandonment risk, and blast radius if a dependency disappears.
- **Guiding questions:**
  - Which dependencies are critical (system fails without them) vs. convenient (degraded without them)?
  - What happens if a key dependency is abandoned, acquired, or ships a breaking change?
  - Are there dependencies with a single maintainer or unclear funding?
  - How deep is your transitive dependency tree — do you know what you're actually running?
  - Could you replace this dependency in an emergency?
  - Is the dependency's release cadence and stability compatible with yours?
- **Required fields:**
  - `dependency_map` — Critical vs. convenient dependencies
  - `single_points_of_failure` — Dependencies with no alternative
  - `abandonment_risk` — Dependencies with maintainer/funding risk
  - `replacement_cost` — Effort to swap out each critical dependency
- **Related:** build-vs-buy (buying creates dependencies), blast-radius (dependency failure has a blast radius), attack-surface (each dependency expands attack surface)
- **Counterbalance:** kiss — "Vendoring everything or writing everything in-house to avoid dependency risk can be worse than the risk itself"

#### operations/migration.yaml

- **Tags:** migration, evolution, transition, strangler-fig, rollback
- **Description:** How do you get from state A to state B safely? Every migration has a spectrum from big-bang (fast, risky) to incremental (slow, safe). Analyze the intermediate states, rollback strategy, and what happens when you're running both old and new simultaneously.
- **Guiding questions:**
  - Can this be done incrementally, or must it be all-at-once?
  - What does the system look like during the transition — is the intermediate state safe?
  - What's the rollback plan at each stage?
  - How do you verify the new state is correct before cutting over?
  - Is there a point of no return — when does rollback become impossible?
  - How long will old and new coexist, and what's the cost of dual-running?
- **Required fields:**
  - `migration_strategy` — Big-bang, strangler fig, parallel run, expand-contract — and why
  - `intermediate_states` — What the system looks like mid-migration
  - `rollback_plan` — How to reverse at each stage, and when reversal becomes impossible
  - `verification_approach` — How to confirm the migration succeeded before decommissioning the old
- **Related:** reversibility (rollback is reversibility applied to migration), blast-radius (migration failure blast radius), constraints (the binding constraint often determines migration strategy)
- **Counterbalance:** occams-razor — "Is incremental migration worth the dual-running complexity, or would a well-planned cutover be simpler and safer?"

### New category: reliability/

#### reliability/observability-gaps.yaml

- **Tags:** observability, monitoring, blind-spots, logging, tracing
- **Description:** What can't you see about this system right now? Observability is the ability to understand internal state from external outputs. The dangerous gap is between "nothing is alerting" and "everything is fine." Map what's visible, what's invisible, and what you'd wish you could see during the next incident.
- **Guiding questions:**
  - If this system broke right now, how would you know?
  - What questions can you answer from current metrics, logs, and traces?
  - What questions can't you answer?
  - Are you measuring symptoms (errors, latency) or causes (queue depth, connection pool usage)?
  - Where are you relying on absence of alerts rather than presence of health signals?
  - Can you trace a single request end-to-end through the system?
- **Required fields:**
  - `observable_signals` — What you can currently see (metrics, logs, traces)
  - `blind_spots` — What you can't see or can only see after the fact
  - `symptom_vs_cause` — Where monitoring detects symptoms but not root causes
  - `incident_readiness` — Could you diagnose last month's incident from current observability alone?
- **Related:** failure-modes (you need to observe the failure modes you've identified), error-propagation (can you trace error paths through observability?), operational-complexity (more observability can add operational burden)
- **Counterbalance:** kiss — "Instrumenting everything creates noise and maintenance burden; what's actually worth watching?"

#### reliability/error-budgets.yaml

- **Tags:** reliability, SLO, budget, velocity, tradeoffs
- **Description:** How much unreliability can you afford, and where do you spend it? Frames reliability as a finite resource — not "maximize uptime" but "what level of failure is acceptable and how do we allocate it?" Shifts the conversation from zero-defect thinking to explicit trade-offs between velocity and stability.
- **Guiding questions:**
  - What's the actual reliability requirement — who suffers at what failure rate?
  - How much error budget do you have (e.g., 99.9% = 8.7 hours/year of downtime)?
  - Where is the error budget being spent today — deploys, infrastructure, dependencies?
  - Are you underspending (moving too slowly) or overspending (too many incidents)?
  - Which components need tight budgets and which can tolerate more failure?
  - Does the team know when the budget is nearly exhausted?
- **Required fields:**
  - `reliability_requirements` — Who needs what level of reliability, and why
  - `budget_allocation` — Where the error budget is currently being spent
  - `velocity_tradeoff` — What the team could ship faster if reliability requirements were relaxed, or vice versa
  - `budget_signals` — How the team knows when budget is running low
- **Related:** margin-of-safety (error budget is a formalized margin), graceful-degradation (what to sacrifice when budget is spent), constraints (reliability can be the binding constraint on velocity)
- **Counterbalance:** inversion — "What if your SLO is wrong? What if users actually tolerate more failure than you think, or far less?"

#### reliability/graceful-degradation.yaml

- **Tags:** degradation, resilience, priorities, fallback, partial-failure
- **Description:** When resources become scarce or components fail, what does the system sacrifice first? Every system has an implicit priority hierarchy — this model makes it explicit. The alternative to graceful degradation is ungraceful degradation, where the system decides for you (usually badly).
- **Guiding questions:**
  - What are the system's core functions vs. nice-to-have features?
  - If the database is slow, what still works?
  - If a downstream service is down, what degrades vs. what breaks entirely?
  - Is there a defined hierarchy: what sheds first, second, third?
  - Do users experience degradation or a cliff edge (works then completely broken)?
  - Are degradation paths tested, or are they theoretical?
- **Required fields:**
  - `priority_hierarchy` — What's essential, important, and expendable under pressure
  - `degradation_modes` — For each failure scenario, what degrades and how
  - `cliff_edges` — Where the system goes from working to completely broken with no middle ground
  - `tested_vs_theoretical` — Which degradation paths have been tested under realistic conditions
- **Related:** failure-modes (degradation is the response to failure modes), blast-radius (graceful degradation limits effective blast radius), error-budgets (degradation is how you spend error budget deliberately)
- **Counterbalance:** kiss — "Degradation paths are code paths that rarely run and are hard to test; is partial functionality worth the complexity vs. fast recovery?"

#### reliability/back-pressure.yaml

- **Tags:** back-pressure, overload, rate-limiting, stability, capacity
- **Description:** When a system is overwhelmed, does it push back or collapse? Systems without back-pressure accept work faster than they can process it, leading to unbounded queue growth, resource exhaustion, and cascading failure. Back-pressure propagates "slow down" signals upstream before collapse.
- **Guiding questions:**
  - What happens when this system receives 10x normal load?
  - Where are there unbounded queues or buffers that can grow without limit?
  - Does the system signal "slow down" to callers, or silently accept work until it dies?
  - What's the failure mode under overload — graceful rejection or cascading collapse?
  - Where are timeouts missing or set too high?
  - Can a single misbehaving caller overwhelm the system for everyone?
- **Required fields:**
  - `overload_behavior` — What actually happens today under extreme load
  - `unbounded_resources` — Queues, buffers, connection pools that can grow without limit
  - `pressure_signals` — Where and how the system signals callers to slow down
  - `isolation_gaps` — Where one caller's load can affect others
- **Related:** queuing-theory (back-pressure is what happens when queuing assumptions break), graceful-degradation (back-pressure enables graceful degradation under load), buffers (buffers without back-pressure become unbounded queues)
- **Counterbalance:** margin-of-safety — "Over-provisioning can be simpler than back-pressure mechanisms; is the system likely to actually face overload?"

#### reliability/operational-complexity.yaml

- **Tags:** operations, complexity, cognitive-load, runbooks, toil
- **Description:** How hard is this system to run day-to-day? Operational complexity is the burden on the humans who keep the system alive — the things that don't show up in architecture diagrams or code reviews. A system that's elegant to build but miserable to operate has shifted complexity, not reduced it.
- **Guiding questions:**
  - How many things must an operator hold in their head to diagnose a problem?
  - How many manual steps are required for routine operations (deploys, rollbacks, scaling)?
  - What tribal knowledge exists that isn't documented or automated?
  - How many different dashboards, log sources, and tools must be consulted during an incident?
  - What's the on-call burden — how often do people get paged, and for what?
  - Could a new team member operate this system after reading the docs?
- **Required fields:**
  - `operational_burden` — Routine tasks that require human attention
  - `tribal_knowledge` — Undocumented knowledge needed to operate the system
  - `incident_complexity` — How many systems/tools/steps involved in typical incident response
  - `automation_gaps` — Manual operations that could be automated but aren't
- **Related:** observability-gaps (poor observability increases operational complexity), kiss (operational complexity is a form of accidental complexity), leverage-points (automating the highest-burden operations has outsized impact)
- **Counterbalance:** build-vs-buy — "Operational tooling costs time to build; is the burden large enough to justify the investment?"

### New category: paradigms/

#### paradigms/functional.yaml

- **Tags:** functional, immutability, side-effects, composition, purity
- **Description:** Where is state being mutated, and where are side effects hiding? The functional lens asks you to trace data transformations and separate pure logic from impure effects. Applied to any codebase — not just functional ones — it reveals hidden mutation, tangled side effects, and composition opportunities that are invisible from within the dominant paradigm.
- **Guiding questions:**
  - Where is state mutated, and could those mutations be replaced with transformations that return new values?
  - Where are side effects (I/O, logging, database calls) tangled with business logic?
  - Can you trace data from input to output without following mutable state through multiple objects?
  - Are there functions that are hard to test because they depend on external state?
  - Where could operations compose (output of one feeds input of next) but currently don't?
  - Are there places where shared mutable state forces ordering constraints that pure functions would eliminate?
- **Required fields:**
  - `mutation_map` — Where state is mutated and whether mutation is essential or incidental
  - `side_effect_boundaries` — Where side effects live (at the edges or buried in the core?)
  - `composition_opportunities` — Logic that could be expressed as composable transformations
  - `testability_assessment` — What's hard to test because of impurity, and what would isolation gain you?
- **Related:** state-ownership (functional lens clarifies ownership by minimizing shared mutation), error-propagation (pure functions make error paths explicit through return types), data-transformation-fidelity (functional composition is how you build reliable transformation chains)
- **Counterbalance:** domain-modeling — "Not everything is a data transformation; some problems are better understood as entities with identity, behavior, and lifecycle"

#### paradigms/domain-modeling.yaml

- **Tags:** OOP, domain, entities, responsibility, identity, behavior
- **Description:** What are the entities, who owns what behavior, and where does identity matter? The domain modeling lens asks whether the code reflects the problem domain clearly — whether a domain expert could recognize their concepts in your code. Surfaces god objects, anemic models, misplaced behavior, and confusion between things that have identity (entities) and things that are just values.
- **Guiding questions:**
  - Can a domain expert read this code and recognize the business concepts?
  - Where does behavior live — with the data it operates on, or scattered elsewhere?
  - Which things have identity (matters which one) vs. which are values (only the content matters)?
  - Are there objects with too many responsibilities — god objects doing everything?
  - Are there objects that are just data bags with no behavior (anemic model)?
  - Where is domain logic leaking into infrastructure code (controllers, serializers, handlers)?
- **Required fields:**
  - `entity_map` — Key domain entities, their responsibilities, and whether they're well-bounded
  - `behavior_placement` — Where domain logic lives (with the data or scattered?)
  - `identity_vs_value` — Which objects need identity tracking and which are interchangeable values
  - `domain_leakage` — Where business rules have leaked into infrastructure layers
- **Related:** separation-of-concerns (domain logic should be separated from infrastructure), contract-boundaries (entity interfaces are contracts), modularity (entities suggest module boundaries)
- **Counterbalance:** functional — "Not everything is an entity with lifecycle; some problems are better understood as stateless data transformations"

#### paradigms/event-driven.yaml

- **Tags:** events, temporal, ordering, audit, decoupling, reactive
- **Description:** What happened, in what order, and who cares? The event-driven lens introduces the time dimension that other paradigms largely ignore. It asks you to think about the system as a sequence of things that happened rather than a snapshot of current state. Surfaces temporal coupling, hidden ordering dependencies, and places where you need audit trails or replay-ability.
- **Guiding questions:**
  - What are the significant things that happen in this system — the events?
  - Where does the order of operations matter, and is that ordering guaranteed?
  - Where are components coupled by timing rather than by data or interface?
  - If you replayed all events from the beginning, would you get the same state?
  - Where would an audit trail (who did what when) add value?
  - Are there places where the current state is insufficient — where you need to know how you got here?
- **Required fields:**
  - `event_catalog` — Significant events in the system and who produces/consumes them
  - `temporal_coupling` — Where components depend on timing or ordering that isn't guaranteed
  - `replay_analysis` — Could the current state be reconstructed from events? Would that be valuable?
  - `audit_gaps` — Where you need to know what happened but currently only know current state
- **Related:** state-ownership (events are an alternative to shared state — communicate by events instead of sharing data), back-pressure (event streams need back-pressure when consumers fall behind), data-transformation-fidelity (events flowing through processors are a transformation chain)
- **Counterbalance:** domain-modeling — "Events can fragment domain logic across handlers; sometimes a coherent entity with clear methods is simpler than a stream of events"

## Strategy Updates

### system-design.yaml — add two tracks

**data-flow:**
- Lenses: `[state-ownership, data-transformation-fidelity, contract-boundaries, functional]`
- Focus: "Who owns the state, does data survive transformations intact, are contracts explicit? THEN challenge through a functional lens: could this be stateless transformations instead of shared mutable state?"

**operational-readiness:**
- Lenses: `[observability-gaps, operational-complexity, graceful-degradation, kiss]`
- Focus: "Can you see what's happening, can you operate it, does it degrade gracefully? THEN challenge: is the observability and degradation machinery worth its own complexity?"

### code-review.yaml — add one track

**data-and-state:**
- Lenses: `[state-ownership, error-propagation, contract-boundaries, occams-razor]`
- Focus: "Who owns this state, how do errors travel, are contracts explicit? THEN: is the analysis revealing real risk, or are we over-scrutinizing stable code?"

### incident-investigation.yaml — add one track

**observability:**
- Lenses: `[observability-gaps, error-propagation, back-pressure, operational-complexity]`
- Focus: "What can't we see, how did the error travel, was the system overwhelmed? THEN: is our tooling making diagnosis harder than the problem itself?"

### New strategy: technical-decision.yaml

A multi-track playbook for evaluating build/buy, migration, and technology choices.

**decision:**
- Lenses: `[build-vs-buy, dependency-risk, reversibility, constraints]`
- Focus: "What's the true cost of each path, what dependencies does it create, can we reverse it? THEN: does the binding constraint make the decision for us regardless?"

**migration:**
- Lenses: `[migration, blast-radius, error-budgets, occams-razor]`
- Focus: "How do we transition safely, what's the blast radius if it goes wrong, how much risk can we budget? THEN: is incremental migration worth the dual-running complexity?"

**paradigm:**
- Lenses: `[functional, domain-modeling, event-driven, kiss]`
- Focus: "What does each paradigm reveal about the approach? THEN: is paradigm purity helping or adding accidental complexity?"

## Inventory Summary

| Location | Model | New/Existing Category |
|---|---|---|
| architecture/state-ownership | State Ownership | Existing |
| architecture/error-propagation | Error Propagation | Existing |
| architecture/contract-boundaries | Contract Boundaries | Existing |
| architecture/data-transformation-fidelity | Data Transformation Fidelity | Existing |
| reasoning/build-vs-buy | Build vs. Buy | Existing |
| reasoning/dependency-risk | Dependency Risk | Existing |
| operations/migration | Migration | Existing |
| reliability/observability-gaps | Observability Gaps | New |
| reliability/error-budgets | Error Budgets | New |
| reliability/graceful-degradation | Graceful Degradation | New |
| reliability/back-pressure | Back Pressure | New |
| reliability/operational-complexity | Operational Complexity | New |
| paradigms/functional | Functional Lens | New |
| paradigms/domain-modeling | Domain Modeling Lens | New |
| paradigms/event-driven | Event-Driven Lens | New |

**Strategies modified:** system-design (+2 tracks), code-review (+1 track), incident-investigation (+1 track)
**Strategies added:** technical-decision (3 tracks)

## TODO

- [ ] **Strategy tracks need schema changes.** The "Strategy Updates" section describes ordered lens sequences within concerns (e.g., "data-flow: [state-ownership, data-transformation-fidelity, ...]") but the current `StrategyDefinition` type only supports `{domain, focus, weight}`. Either define the schema changes needed or rewrite the strategy updates to use the existing concern format.
- [ ] **Add back-references to existing models.** New models declare `related_models` edges to existing models, but existing models don't reference back. This makes the graph asymmetric — `expand_selection` from e.g. `failure-modes` won't surface `error-propagation` as a neighbor. Update existing YAML files where the relationship is genuinely bidirectional.
- [ ] **Review KISS counterbalance concentration.** 6/15 new models use KISS as counterbalance. The tensions are individually specific, but some models may benefit from more targeted counterbalances (e.g., `graceful-degradation` ↔ `back-pressure` instead of KISS).
