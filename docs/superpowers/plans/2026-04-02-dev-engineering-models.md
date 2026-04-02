# Dev/Engineering Models Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 15 new systems-thinking models focused on development/engineering, update 3 existing strategies with new tracks, and add 1 new strategy.

**Architecture:** All models are YAML files loaded dynamically by `src/loader.ts` from `models/<category>/` subdirectories. Strategies are YAML files loaded from `strategies/`. No TypeScript code changes are needed — the loader picks up new files automatically. Two new category directories are created: `models/reliability/` and `models/paradigms/`.

**Tech Stack:** YAML files only. Vitest for validation tests.

**Spec:** `docs/superpowers/specs/2026-04-02-dev-engineering-models-design.md`

---

## Chunk 1: Architecture category models (4 new models)

### Task 1: Create state-ownership model

**Files:**
- Create: `models/architecture/state-ownership.yaml`

- [ ] **Step 1: Create the model YAML file**

```yaml
id: state-ownership
name: State Ownership
tags: [state, ownership, mutation, coupling, consistency]
description: >
  Who owns this state, and what happens when ownership is unclear? Shared
  mutable state is the most common source of subtle bugs. Trace where
  state lives, who reads it, who writes it, and what breaks when it's
  inconsistent.

guiding_questions:
  - Where does mutable state live?
  - Who reads vs. writes it?
  - Is there a single source of truth or multiple copies?
  - What happens when copies diverge?
  - Where is state implicitly shared through globals, caches, or databases?
  - Could this state be derived instead of stored?

required_fields:
  state_map:
    description: Where state lives and who owns it
    hint: "User session → Redis (owned by auth service). Order totals → DB (owned by checkout). Cart → client localStorage (owned by frontend)."
  shared_state_risks:
    description: State accessed by multiple writers
    hint: "Inventory count updated by checkout, returns, and warehouse sync — last-write-wins race condition."
  consistency_model:
    description: How consistency is maintained — locks, events, eventual
    hint: "Strong consistency via DB transactions for payments. Eventual consistency via events for analytics."
  derived_vs_stored:
    description: State that could be computed instead of stored
    hint: "Order total is stored but could be derived from line items. User 'active' flag is stored but could be derived from last-login timestamp."

related_models:
  - id: coupling-cohesion
    reason: "Shared state is hidden coupling between components"
  - id: error-propagation
    reason: "Inconsistent state produces errors that propagate downstream"
  - id: feedback-loops
    reason: "State changes can create reinforcing loops (cache invalidation storms, retry amplification)"

counterbalances:
  - id: kiss
    tension: "Strict state ownership boundaries add indirection — is the isolation worth the complexity?"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: All existing loader tests PASS (new YAML is picked up by existing loader logic).

- [ ] **Step 3: Commit**

```bash
git add models/architecture/state-ownership.yaml
git commit -m "feat: add state-ownership model"
```

### Task 2: Create error-propagation model

**Files:**
- Create: `models/architecture/error-propagation.yaml`

- [ ] **Step 1: Create the model YAML file**

```yaml
id: error-propagation
name: Error Propagation
tags: [errors, propagation, cascade, handling, resilience]
description: >
  How do errors travel through the system? Where are they caught,
  transformed, swallowed, or amplified? Different from failure-modes
  (which asks what fails) — this traces the journey of a failure signal
  from origin to observable symptom.

guiding_questions:
  - When an error occurs here, what does the caller see?
  - Where are errors swallowed silently?
  - Where do errors transform into something unintelligible?
  - Do errors cross boundaries with enough context to be actionable?
  - Where can a small error cascade into a large outage?
  - Are retry/fallback paths themselves error-prone?

required_fields:
  error_paths:
    description: How errors flow from origin to user
    hint: "DB timeout → ORM exception → generic 500 → user sees 'Something went wrong'. Context lost at ORM layer."
  swallowed_errors:
    description: Where errors are caught and silently discarded
    hint: "Background job catch-all logs to debug level and continues. Cache write failures ignored. Event publish errors swallowed."
  error_transformation:
    description: Where error context is lost or mangled
    hint: "Microservice A returns detailed error, API gateway maps it to generic 502. Stack trace stripped at service boundary."
  cascade_risks:
    description: Where a small error amplifies into a large one
    hint: "Auth service timeout → all requests retry → 3x load on auth → full outage. One bad record → batch job fails → entire import rolled back."

related_models:
  - id: failure-modes
    reason: "What fails — this model traces where failure goes next"
  - id: blast-radius
    reason: "Error propagation paths determine blast radius"
  - id: state-ownership
    reason: "Inconsistent state produces errors that propagate downstream"

counterbalances:
  - id: occams-razor
    tension: "Not every error path needs hardening — is the most likely failure mode actually this complex?"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add models/architecture/error-propagation.yaml
git commit -m "feat: add error-propagation model"
```

### Task 3: Create contract-boundaries model

**Files:**
- Create: `models/architecture/contract-boundaries.yaml`

- [ ] **Step 1: Create the model YAML file**

```yaml
id: contract-boundaries
name: Contract Boundaries
tags: [contracts, interfaces, API, assumptions, compatibility]
description: >
  What's actually promised at this interface, and what's merely assumed?
  Every boundary between components has an explicit contract (documented
  API) and an implicit contract (behavior callers depend on but nobody
  promised). When internals change, implicit contracts break.

guiding_questions:
  - What does this interface explicitly promise?
  - What behavior do callers rely on that isn't documented?
  - What happens if the response format, ordering, or timing changes?
  - Where are internal implementation details leaking through the interface?
  - Are error contracts (what errors can be returned) well-defined?
  - Could this interface change without breaking consumers?

required_fields:
  explicit_contracts:
    description: Documented promises — API specs, schemas, SLAs
    hint: "REST API with OpenAPI spec. Response always includes 'id' and 'status' fields. 99.9% uptime SLA."
  implicit_contracts:
    description: Undocumented behavior callers depend on
    hint: "Results always returned sorted by date (not documented). Error responses include a 'details' field (not in spec). Response time under 200ms (no SLA)."
  breaking_change_risk:
    description: What internal changes would break consumers
    hint: "Changing sort order would break frontend pagination. Removing 'details' from errors would break client error handling."
  contract_enforcement:
    description: How contracts are validated — types, tests, schemas, runtime checks
    hint: "OpenAPI validation in CI. Contract tests between services. No runtime schema validation on responses."

related_models:
  - id: coupling-cohesion
    reason: "Implicit contracts are hidden coupling"
  - id: separation-of-concerns
    reason: "Good contracts enforce separation between components"
  - id: trust-boundaries
    reason: "Contracts define what to trust across boundaries"

counterbalances:
  - id: kiss
    tension: "Strict contract enforcement adds overhead — is the formality justified for internal interfaces?"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add models/architecture/contract-boundaries.yaml
git commit -m "feat: add contract-boundaries model"
```

### Task 4: Create data-transformation-fidelity model

**Files:**
- Create: `models/architecture/data-transformation-fidelity.yaml`

- [ ] **Step 1: Create the model YAML file**

```yaml
id: data-transformation-fidelity
name: Data Transformation Fidelity
tags: [data, transformation, pipeline, integrity, mapping]
description: >
  Does data arrive intact after all transformations? Trace how data moves
  and transforms through a pipeline — where it's enriched, filtered,
  aggregated, serialized, or silently lost. Different from stock-and-flow
  (accumulation rates) — this is about whether transformations preserve
  meaning.

guiding_questions:
  - What transformations does data undergo from source to destination?
  - Where could precision, context, or fields be silently lost?
  - Are transformations reversible or lossy?
  - Where are implicit type coercions or format conversions?
  - Do transformations compose correctly, or does order matter in subtle ways?
  - Where could encoding issues (unicode, timezone, null handling) corrupt data?

required_fields:
  transformation_chain:
    description: Ordered sequence of transformations from source to destination
    hint: "User input → validation → normalize → enrich with geo data → serialize to JSON → publish to queue → deserialize → store in DB."
  lossy_steps:
    description: Where data is irreversibly reduced or dropped
    hint: "Truncating description to 255 chars. Rounding currency to 2 decimal places. Dropping unknown fields during deserialization."
  fidelity_risks:
    description: Where meaning could be silently corrupted — coercions, truncation, encoding
    hint: "Timezone stripped during JSON serialization (dates become ambiguous). Unicode normalization changes user-entered text. Null vs empty string conflated."
  round_trip_analysis:
    description: Can data survive a round-trip through the pipeline intact?
    hint: "Export → import loses custom fields. API response → re-submit changes date format. DB → CSV → DB loses precision on decimals."

related_models:
  - id: state-ownership
    reason: "Who owns the canonical form of this data?"
  - id: contract-boundaries
    reason: "Each transformation step has input/output contracts"
  - id: source-sink
    reason: "Data originates at sources and arrives at sinks — transformations happen in between"

counterbalances:
  - id: occams-razor
    tension: "Not every pipeline needs formal schema validation at each step — where is corruption actually likely?"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add models/architecture/data-transformation-fidelity.yaml
git commit -m "feat: add data-transformation-fidelity model"
```

## Chunk 2: Reasoning and operations models (3 new models)

### Task 5: Create build-vs-buy model

**Files:**
- Create: `models/reasoning/build-vs-buy.yaml`

- [ ] **Step 1: Create the model YAML file**

```yaml
id: build-vs-buy
name: Build vs. Buy
tags: [decisions, cost, vendor, ownership, tradeoffs]
description: >
  What's the true total cost of building versus buying? Both paths have
  costs people systematically underestimate. Building underestimates
  maintenance, opportunity cost, and expertise required. Buying
  underestimates integration cost, vendor lock-in, and customization limits.

guiding_questions:
  - What's the total cost of building, including maintenance for the next 3 years?
  - What's the total cost of buying, including integration and customization?
  - How core is this to our business — is it a differentiator or commodity?
  - What happens if the vendor goes away, raises prices, or pivots?
  - How much customization will we actually need?
  - Do we have the expertise to build and maintain this?

required_fields:
  build_cost:
    description: Realistic total cost including maintenance and opportunity cost
    hint: "6 months to build, 2 engineers ongoing maintenance, delays other roadmap items by a quarter. Team lacks deep expertise in this domain."
  buy_cost:
    description: Realistic total cost including integration, customization, and lock-in
    hint: "$50k/year license. 3 months integration. Limited to vendor's data model. Migration away would take 6 months."
  core_vs_commodity:
    description: Is this a differentiator worth investing in, or solved infrastructure?
    hint: "Auth is commodity — buy it. Recommendation engine is our differentiator — build it. Billing is commodity but our model is unusual — evaluate carefully."
  exit_cost:
    description: What it costs to switch if we choose wrong
    hint: "Switching from vendor A to B: 3 months migration, data export limitations, retraining. Switching from custom to vendor: discard 6 months of work."

related_models:
  - id: reversibility
    reason: "How reversible is each path — can you switch later?"
  - id: dependency-risk
    reason: "Buying creates a dependency on the vendor"
  - id: margin-of-safety
    reason: "Budget margin for whichever path you choose"

counterbalances:
  - id: constraints
    tension: "Sometimes the binding constraint (time, money, expertise) makes the decision for you regardless of total-cost analysis"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add models/reasoning/build-vs-buy.yaml
git commit -m "feat: add build-vs-buy model"
```

### Task 6: Create dependency-risk model

**Files:**
- Create: `models/reasoning/dependency-risk.yaml`

- [ ] **Step 1: Create the model YAML file**

```yaml
id: dependency-risk
name: Dependency Risk
tags: [dependencies, supply-chain, risk, resilience, third-party]
description: >
  What happens when something you depend on breaks? Every dependency is a
  bet that the maintainer's priorities will continue to align with yours.
  Analyze your dependency chain for single points of failure, abandonment
  risk, and blast radius if a dependency disappears.

guiding_questions:
  - Which dependencies are critical (system fails without them) vs. convenient (degraded without them)?
  - What happens if a key dependency is abandoned, acquired, or ships a breaking change?
  - Are there dependencies with a single maintainer or unclear funding?
  - How deep is your transitive dependency tree — do you know what you're actually running?
  - Could you replace this dependency in an emergency?
  - Is the dependency's release cadence and stability compatible with yours?

required_fields:
  dependency_map:
    description: Critical vs. convenient dependencies
    hint: "Critical: database driver, auth library, payment SDK. Convenient: date formatting, logging facade, test utilities."
  single_points_of_failure:
    description: Dependencies with no alternative
    hint: "Payment gateway — only integration, no fallback. Proprietary data format — only one parser exists."
  abandonment_risk:
    description: Dependencies with maintainer or funding risk
    hint: "Core utility maintained by one person, last commit 8 months ago. SDK tied to startup with no revenue model."
  replacement_cost:
    description: Effort to swap out each critical dependency
    hint: "Database driver: 2 weeks (standard interface). Payment SDK: 2 months (deeply integrated, custom flows). Auth library: 1 month (abstracted behind interface)."

related_models:
  - id: build-vs-buy
    reason: "Buying creates dependencies — this model evaluates the risk"
  - id: blast-radius
    reason: "Dependency failure has a blast radius"
  - id: attack-surface
    reason: "Each dependency expands the attack surface"

counterbalances:
  - id: kiss
    tension: "Vendoring everything or writing everything in-house to avoid dependency risk can be worse than the risk itself"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add models/reasoning/dependency-risk.yaml
git commit -m "feat: add dependency-risk model"
```

### Task 7: Create migration model

**Files:**
- Create: `models/operations/migration.yaml`

- [ ] **Step 1: Create the model YAML file**

```yaml
id: migration
name: Migration
tags: [migration, evolution, transition, strangler-fig, rollback]
description: >
  How do you get from state A to state B safely? Every migration has a
  spectrum from big-bang (fast, risky) to incremental (slow, safe).
  Analyze the intermediate states, rollback strategy, and what happens
  when you're running both old and new simultaneously.

guiding_questions:
  - Can this be done incrementally, or must it be all-at-once?
  - What does the system look like during the transition — is the intermediate state safe?
  - What's the rollback plan at each stage?
  - How do you verify the new state is correct before cutting over?
  - Is there a point of no return — when does rollback become impossible?
  - How long will old and new coexist, and what's the cost of dual-running?

required_fields:
  migration_strategy:
    description: Big-bang, strangler fig, parallel run, expand-contract — and why
    hint: "Strangler fig — route new traffic to new service, old traffic stays until migrated. Chosen because rollback is just routing change."
  intermediate_states:
    description: What the system looks like mid-migration
    hint: "During migration: both old and new tables exist, writes go to both, reads prefer new. Risk: data divergence if sync fails."
  rollback_plan:
    description: How to reverse at each stage, and when reversal becomes impossible
    hint: "Before cutover: revert routing. After cutover but before decommission: restore from backup. After decommission: cannot rollback."
  verification_approach:
    description: How to confirm the migration succeeded before decommissioning the old
    hint: "Shadow traffic comparison for 2 weeks. Row-by-row data validation script. Canary at 1% traffic with error rate monitoring."

related_models:
  - id: reversibility
    reason: "Rollback is reversibility applied to migration"
  - id: blast-radius
    reason: "Migration failure has a blast radius — how much breaks if it goes wrong?"
  - id: constraints
    reason: "The binding constraint often determines migration strategy — time, risk tolerance, team capacity"

counterbalances:
  - id: occams-razor
    tension: "Is incremental migration worth the dual-running complexity, or would a well-planned cutover be simpler and safer?"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add models/operations/migration.yaml
git commit -m "feat: add migration model"
```

## Chunk 3: Reliability category models (5 new models)

### Task 8: Create reliability directory and observability-gaps model

**Files:**
- Create: `models/reliability/observability-gaps.yaml`

- [ ] **Step 1: Create the reliability directory and model YAML file**

```bash
mkdir -p models/reliability
```

```yaml
id: observability-gaps
name: Observability Gaps
tags: [observability, monitoring, blind-spots, logging, tracing]
description: >
  What can't you see about this system right now? Observability is the
  ability to understand internal state from external outputs. The
  dangerous gap is between "nothing is alerting" and "everything is fine."
  Map what's visible, what's invisible, and what you'd wish you could see
  during the next incident.

guiding_questions:
  - If this system broke right now, how would you know?
  - What questions can you answer from current metrics, logs, and traces?
  - What questions can't you answer?
  - Are you measuring symptoms (errors, latency) or causes (queue depth, connection pool usage)?
  - Where are you relying on absence of alerts rather than presence of health signals?
  - Can you trace a single request end-to-end through the system?

required_fields:
  observable_signals:
    description: What you can currently see — metrics, logs, traces
    hint: "HTTP error rates, response latency p50/p99, CPU/memory per pod, application logs in CloudWatch. No distributed tracing."
  blind_spots:
    description: What you can't see or can only see after the fact
    hint: "No visibility into queue depths. Cache hit rates not tracked. Inter-service latency not measured. Database connection pool utilization unknown."
  symptom_vs_cause:
    description: Where monitoring detects symptoms but not root causes
    hint: "We alert on high error rates (symptom) but can't see which downstream dependency caused it (cause). We see high latency but not whether it's DB, cache, or network."
  incident_readiness:
    description: Could you diagnose last month's incident from current observability alone?
    hint: "Last outage was a connection pool exhaustion. We saw errors but couldn't identify pool saturation until we SSH'd into the box. Need connection pool metrics."

related_models:
  - id: failure-modes
    reason: "You need to observe the failure modes you've identified"
  - id: error-propagation
    reason: "Can you trace error paths through your observability?"
  - id: operational-complexity
    reason: "More observability can add operational burden"

counterbalances:
  - id: kiss
    tension: "Instrumenting everything creates noise and maintenance burden — what's actually worth watching?"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add models/reliability/observability-gaps.yaml
git commit -m "feat: add observability-gaps model (new reliability category)"
```

### Task 9: Create error-budgets model

**Files:**
- Create: `models/reliability/error-budgets.yaml`

- [ ] **Step 1: Create the model YAML file**

```yaml
id: error-budgets
name: Error Budgets
tags: [reliability, SLO, budget, velocity, tradeoffs]
description: >
  How much unreliability can you afford, and where do you spend it? Frames
  reliability as a finite resource — not "maximize uptime" but "what level
  of failure is acceptable and how do we allocate it?" Shifts the
  conversation from zero-defect thinking to explicit trade-offs between
  velocity and stability.

guiding_questions:
  - What's the actual reliability requirement — who suffers at what failure rate?
  - How much error budget do you have (e.g., 99.9% = 8.7 hours/year of downtime)?
  - Where is the error budget being spent today — deploys, infrastructure, dependencies?
  - Are you underspending (moving too slowly) or overspending (too many incidents)?
  - Which components need tight budgets and which can tolerate more failure?
  - Does the team know when the budget is nearly exhausted?

required_fields:
  reliability_requirements:
    description: Who needs what level of reliability, and why
    hint: "Payment processing: 99.99% (financial loss per minute of downtime). Dashboard: 99.9% (annoying but not critical). Batch reports: 99% (can retry next day)."
  budget_allocation:
    description: Where the error budget is currently being spent
    hint: "60% on deploy-related incidents, 25% on infrastructure (cloud provider), 15% on dependency failures. Deploys are the biggest consumer."
  velocity_tradeoff:
    description: What the team could ship faster if reliability requirements were relaxed, or vice versa
    hint: "If dashboard SLO relaxed to 99.5%, we could deploy 3x more often without risk. If payment SLO tightened to 99.999%, we'd need a deploy freeze process."
  budget_signals:
    description: How the team knows when budget is running low
    hint: "Automated SLO burn rate alert at 50% consumed. Weekly SLO review in team standup. No signal currently — we find out after the fact."

related_models:
  - id: margin-of-safety
    reason: "Error budget is a formalized margin of safety"
  - id: graceful-degradation
    reason: "What to sacrifice when error budget is spent"
  - id: constraints
    reason: "Reliability can be the binding constraint on velocity"

counterbalances:
  - id: inversion
    tension: "What if your SLO is wrong? What if users actually tolerate more failure than you think, or far less?"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add models/reliability/error-budgets.yaml
git commit -m "feat: add error-budgets model"
```

### Task 10: Create graceful-degradation model

**Files:**
- Create: `models/reliability/graceful-degradation.yaml`

- [ ] **Step 1: Create the model YAML file**

```yaml
id: graceful-degradation
name: Graceful Degradation
tags: [degradation, resilience, priorities, fallback, partial-failure]
description: >
  When resources become scarce or components fail, what does the system
  sacrifice first? Every system has an implicit priority hierarchy — this
  model makes it explicit. The alternative to graceful degradation is
  ungraceful degradation, where the system decides for you (usually badly).

guiding_questions:
  - What are the system's core functions vs. nice-to-have features?
  - If the database is slow, what still works?
  - If a downstream service is down, what degrades vs. what breaks entirely?
  - Is there a defined hierarchy — what sheds first, second, third?
  - Do users experience degradation or a cliff edge (works then completely broken)?
  - Are degradation paths tested, or are they theoretical?

required_fields:
  priority_hierarchy:
    description: What's essential, important, and expendable under pressure
    hint: "Essential: user can log in and view data. Important: search works, notifications deliver. Expendable: recommendations, analytics tracking, non-critical background jobs."
  degradation_modes:
    description: For each failure scenario, what degrades and how
    hint: "Cache down → slower responses but correct data. Search service down → search disabled, browse still works. Payment provider slow → queue orders, confirm async."
  cliff_edges:
    description: Where the system goes from working to completely broken with no middle ground
    hint: "Auth service down → nothing works (no graceful fallback). DB connection pool full → all requests fail simultaneously. No partial failure mode for checkout."
  tested_vs_theoretical:
    description: Which degradation paths have been tested under realistic conditions
    hint: "Cache-down mode tested in staging monthly. Search-disabled fallback never tested. Payment queueing exists in code but never exercised."

related_models:
  - id: failure-modes
    reason: "Degradation is the response to failure modes"
  - id: blast-radius
    reason: "Graceful degradation limits effective blast radius"
  - id: error-budgets
    reason: "Degradation is how you spend error budget deliberately"

counterbalances:
  - id: kiss
    tension: "Degradation paths are code paths that rarely run and are hard to test — is partial functionality worth the complexity vs. fast recovery?"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add models/reliability/graceful-degradation.yaml
git commit -m "feat: add graceful-degradation model"
```

### Task 11: Create back-pressure model

**Files:**
- Create: `models/reliability/back-pressure.yaml`

- [ ] **Step 1: Create the model YAML file**

```yaml
id: back-pressure
name: Back Pressure
tags: [back-pressure, overload, rate-limiting, stability, capacity]
description: >
  When a system is overwhelmed, does it push back or collapse? Systems
  without back-pressure accept work faster than they can process it,
  leading to unbounded queue growth, resource exhaustion, and cascading
  failure. Back-pressure propagates "slow down" signals upstream before
  collapse.

guiding_questions:
  - What happens when this system receives 10x normal load?
  - Where are there unbounded queues or buffers that can grow without limit?
  - Does the system signal "slow down" to callers, or silently accept work until it dies?
  - What's the failure mode under overload — graceful rejection or cascading collapse?
  - Where are timeouts missing or set too high?
  - Can a single misbehaving caller overwhelm the system for everyone?

required_fields:
  overload_behavior:
    description: What actually happens today under extreme load
    hint: "At 5x load: response times degrade linearly. At 10x: OOM kill, full outage, 5-minute recovery. No graceful rejection."
  unbounded_resources:
    description: Queues, buffers, connection pools that can grow without limit
    hint: "In-memory job queue has no max size. Thread pool grows unbounded. Retry queue accumulates during outage with no cap."
  pressure_signals:
    description: Where and how the system signals callers to slow down
    hint: "API returns 429 with Retry-After header at 80% capacity. Queue publishes backlog metric but no consumer uses it. No back-pressure on internal service calls."
  isolation_gaps:
    description: Where one caller's load can affect others
    hint: "All tenants share one connection pool — heavy tenant starves others. No per-client rate limiting on internal APIs. Batch jobs compete with real-time traffic."

related_models:
  - id: queuing-theory
    reason: "Back-pressure is what happens when queuing assumptions break"
  - id: graceful-degradation
    reason: "Back-pressure enables graceful degradation under load"
  - id: buffers
    reason: "Buffers without back-pressure become unbounded queues"

counterbalances:
  - id: margin-of-safety
    tension: "Over-provisioning can be simpler than back-pressure mechanisms — is the system likely to actually face overload?"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add models/reliability/back-pressure.yaml
git commit -m "feat: add back-pressure model"
```

### Task 12: Create operational-complexity model

**Files:**
- Create: `models/reliability/operational-complexity.yaml`

- [ ] **Step 1: Create the model YAML file**

```yaml
id: operational-complexity
name: Operational Complexity
tags: [operations, complexity, cognitive-load, runbooks, toil]
description: >
  How hard is this system to run day-to-day? Operational complexity is the
  burden on the humans who keep the system alive — the things that don't
  show up in architecture diagrams or code reviews. A system that's
  elegant to build but miserable to operate has shifted complexity, not
  reduced it.

guiding_questions:
  - How many things must an operator hold in their head to diagnose a problem?
  - How many manual steps are required for routine operations (deploys, rollbacks, scaling)?
  - What tribal knowledge exists that isn't documented or automated?
  - How many different dashboards, log sources, and tools must be consulted during an incident?
  - What's the on-call burden — how often do people get paged, and for what?
  - Could a new team member operate this system after reading the docs?

required_fields:
  operational_burden:
    description: Routine tasks that require human attention
    hint: "Manual DB migrations every release. Certificate rotation every 90 days. Cache warming after deploys. Log rotation on legacy boxes."
  tribal_knowledge:
    description: Undocumented knowledge needed to operate the system
    hint: "Only Sarah knows how to restart the payment reconciliation job. The deploy script silently fails if run before 6am UTC. Node 3 needs manual restart after DB failover."
  incident_complexity:
    description: How many systems/tools/steps involved in typical incident response
    hint: "Typical incident: check PagerDuty → Grafana dashboard → Kibana logs → SSH to box → check process → restart. 6 tools, 15 minutes before you understand the problem."
  automation_gaps:
    description: Manual operations that could be automated but aren't
    hint: "Scaling is manual kubectl commands. Rollback requires running 3 scripts in order. Health checks exist but don't auto-remediate."

related_models:
  - id: observability-gaps
    reason: "Poor observability increases operational complexity"
  - id: kiss
    reason: "Operational complexity is a form of accidental complexity"
  - id: leverage-points
    reason: "Automating the highest-burden operations has outsized impact"

counterbalances:
  - id: build-vs-buy
    tension: "Operational tooling costs time to build — is the burden large enough to justify the investment?"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add models/reliability/operational-complexity.yaml
git commit -m "feat: add operational-complexity model"
```

## Chunk 4: Paradigms category models (3 new models)

### Task 13: Create paradigms directory and functional model

**Files:**
- Create: `models/paradigms/functional.yaml`

- [ ] **Step 1: Create the paradigms directory and model YAML file**

```bash
mkdir -p models/paradigms
```

```yaml
id: functional
name: Functional Lens
tags: [functional, immutability, side-effects, composition, purity]
description: >
  Where is state being mutated, and where are side effects hiding? The
  functional lens asks you to trace data transformations and separate pure
  logic from impure effects. Applied to any codebase — not just functional
  ones — it reveals hidden mutation, tangled side effects, and composition
  opportunities that are invisible from within the dominant paradigm.

guiding_questions:
  - Where is state mutated, and could those mutations be replaced with transformations that return new values?
  - Where are side effects (I/O, logging, database calls) tangled with business logic?
  - Can you trace data from input to output without following mutable state through multiple objects?
  - Are there functions that are hard to test because they depend on external state?
  - Where could operations compose (output of one feeds input of next) but currently don't?
  - Are there places where shared mutable state forces ordering constraints that pure functions would eliminate?

required_fields:
  mutation_map:
    description: Where state is mutated and whether mutation is essential or incidental
    hint: "Essential: DB writes, file system changes. Incidental: accumulator variable in loop (could be reduce), instance variable updated across methods (could be return value)."
  side_effect_boundaries:
    description: Where side effects live — at the edges or buried in the core?
    hint: "DB calls inside business logic functions. Logging mixed into calculation methods. HTTP calls in domain model constructors. Ideally: effects at edges, pure logic in core."
  composition_opportunities:
    description: Logic that could be expressed as composable transformations
    hint: "Validation → normalization → enrichment currently done in one big method. Could be pipeline: validate(input) |> normalize |> enrich. Each step independently testable."
  testability_assessment:
    description: What's hard to test because of impurity, and what would isolation gain you?
    hint: "Price calculation needs a DB connection to test because it reads tax rates inline. Extract pure calc(price, taxRate) → testable without DB, mock only at boundary."

related_models:
  - id: state-ownership
    reason: "Functional lens clarifies ownership by minimizing shared mutation"
  - id: error-propagation
    reason: "Pure functions make error paths explicit through return types"
  - id: data-transformation-fidelity
    reason: "Functional composition is how you build reliable transformation chains"

counterbalances:
  - id: domain-modeling
    tension: "Not everything is a data transformation — some problems are better understood as entities with identity, behavior, and lifecycle"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add models/paradigms/functional.yaml
git commit -m "feat: add functional lens model (new paradigms category)"
```

### Task 14: Create domain-modeling model

**Files:**
- Create: `models/paradigms/domain-modeling.yaml`

- [ ] **Step 1: Create the model YAML file**

```yaml
id: domain-modeling
name: Domain Modeling Lens
tags: [OOP, domain, entities, responsibility, identity, behavior]
description: >
  What are the entities, who owns what behavior, and where does identity
  matter? The domain modeling lens asks whether the code reflects the
  problem domain clearly — whether a domain expert could recognize their
  concepts in your code. Surfaces god objects, anemic models, misplaced
  behavior, and confusion between things that have identity (entities) and
  things that are just values.

guiding_questions:
  - Can a domain expert read this code and recognize the business concepts?
  - Where does behavior live — with the data it operates on, or scattered elsewhere?
  - Which things have identity (matters which one) vs. which are values (only the content matters)?
  - Are there objects with too many responsibilities — god objects doing everything?
  - Are there objects that are just data bags with no behavior (anemic model)?
  - Where is domain logic leaking into infrastructure code (controllers, serializers, handlers)?

required_fields:
  entity_map:
    description: Key domain entities, their responsibilities, and whether they're well-bounded
    hint: "Order: manages line items, calculates totals, tracks status. User: handles auth AND preferences AND notifications (too many responsibilities). Invoice: data bag with no behavior."
  behavior_placement:
    description: Where domain logic lives — with the data or scattered?
    hint: "Discount calculation in the controller instead of on Order. Validation in the serializer instead of on the entity. Status transitions in a utility function instead of on the model."
  identity_vs_value:
    description: Which objects need identity tracking and which are interchangeable values
    hint: "Order needs identity (specific order matters). Money is a value (any $10 is the same). Address could be either — currently treated as entity but should be value."
  domain_leakage:
    description: Where business rules have leaked into infrastructure layers
    hint: "Tax calculation in the API controller. Discount eligibility in the database query. Status transition rules in the UI component."

related_models:
  - id: separation-of-concerns
    reason: "Domain logic should be separated from infrastructure"
  - id: contract-boundaries
    reason: "Entity interfaces are contracts"
  - id: modularity
    reason: "Entities suggest module boundaries"

counterbalances:
  - id: functional
    tension: "Not everything is an entity with lifecycle — some problems are better understood as stateless data transformations"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add models/paradigms/domain-modeling.yaml
git commit -m "feat: add domain-modeling lens model"
```

### Task 15: Create event-driven model

**Files:**
- Create: `models/paradigms/event-driven.yaml`

- [ ] **Step 1: Create the model YAML file**

```yaml
id: event-driven
name: Event-Driven Lens
tags: [events, temporal, ordering, audit, decoupling, reactive]
description: >
  What happened, in what order, and who cares? The event-driven lens
  introduces the time dimension that other paradigms largely ignore. It
  asks you to think about the system as a sequence of things that happened
  rather than a snapshot of current state. Surfaces temporal coupling,
  hidden ordering dependencies, and places where you need audit trails or
  replay-ability.

guiding_questions:
  - What are the significant things that happen in this system — the events?
  - Where does the order of operations matter, and is that ordering guaranteed?
  - Where are components coupled by timing rather than by data or interface?
  - If you replayed all events from the beginning, would you get the same state?
  - Where would an audit trail (who did what when) add value?
  - Are there places where the current state is insufficient — where you need to know how you got here?

required_fields:
  event_catalog:
    description: Significant events in the system and who produces/consumes them
    hint: "OrderPlaced (checkout → fulfillment, billing, notifications). UserRegistered (auth → onboarding, analytics). PaymentFailed (billing → checkout, support alerts)."
  temporal_coupling:
    description: Where components depend on timing or ordering that isn't guaranteed
    hint: "Notification sent before order confirmed (race condition). Analytics event processed before user record created (missing foreign key). Cache warmed after deploy but before traffic shifted (gap)."
  replay_analysis:
    description: Could the current state be reconstructed from events? Would that be valuable?
    hint: "Order history: yes, events fully describe state transitions. User preferences: no, only current state stored, change history lost. Inventory: partially, adjustments logged but not initial stock."
  audit_gaps:
    description: Where you need to know what happened but currently only know current state
    hint: "Who changed this config and when? Why was this order cancelled — user request or system timeout? When did this permission get granted?"

related_models:
  - id: state-ownership
    reason: "Events are an alternative to shared state — communicate by events instead of sharing data"
  - id: back-pressure
    reason: "Event streams need back-pressure when consumers fall behind"
  - id: data-transformation-fidelity
    reason: "Events flowing through processors are a transformation chain"

counterbalances:
  - id: domain-modeling
    tension: "Events can fragment domain logic across handlers — sometimes a coherent entity with clear methods is simpler than a stream of events"
```

- [ ] **Step 2: Verify the model loads correctly**

Run: `npx vitest run tests/loader.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add models/paradigms/event-driven.yaml
git commit -m "feat: add event-driven lens model"
```

## Chunk 5: Strategy updates and new strategy (4 files)

### Task 16: Update system-design strategy with two new tracks

**Files:**
- Modify: `strategies/system-design.yaml`

- [ ] **Step 1: Add data-flow and operational-readiness tracks**

Add these tracks to the existing `tracks:` section in `strategies/system-design.yaml`:

```yaml
  data-flow:
    lenses: [state-ownership, data-transformation-fidelity, contract-boundaries, functional]
    focus: "Who owns the state, does data survive transformations intact, are contracts explicit? THEN challenge through a functional lens: could this be stateless transformations instead of shared mutable state?"
  operational-readiness:
    lenses: [observability-gaps, operational-complexity, graceful-degradation, kiss]
    focus: "Can you see what's happening, can you operate it, does it degrade gracefully? THEN challenge: is the observability and degradation machinery worth its own complexity?"
```

- [ ] **Step 2: Verify strategies still load**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add strategies/system-design.yaml
git commit -m "feat: add data-flow and operational-readiness tracks to system-design strategy"
```

### Task 17: Update code-review strategy with new track

**Files:**
- Modify: `strategies/code-review.yaml`

- [ ] **Step 1: Add data-and-state track**

Add this track to the existing `tracks:` section in `strategies/code-review.yaml`:

```yaml
  data-and-state:
    lenses: [state-ownership, error-propagation, contract-boundaries, occams-razor]
    focus: "Who owns this state, how do errors travel, are contracts explicit? THEN: is the analysis revealing real risk, or are we over-scrutinizing stable code?"
```

- [ ] **Step 2: Verify strategies still load**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add strategies/code-review.yaml
git commit -m "feat: add data-and-state track to code-review strategy"
```

### Task 18: Update incident-investigation strategy with new track

**Files:**
- Modify: `strategies/incident-investigation.yaml`

- [ ] **Step 1: Add observability track**

Add this track to the existing `tracks:` section in `strategies/incident-investigation.yaml`:

```yaml
  observability:
    lenses: [observability-gaps, error-propagation, back-pressure, operational-complexity]
    focus: "What can't we see, how did the error travel, was the system overwhelmed? THEN: is our tooling making diagnosis harder than the problem itself?"
```

- [ ] **Step 2: Verify strategies still load**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add strategies/incident-investigation.yaml
git commit -m "feat: add observability track to incident-investigation strategy"
```

### Task 19: Create technical-decision strategy

**Files:**
- Create: `strategies/technical-decision.yaml`

- [ ] **Step 1: Create the strategy YAML file**

```yaml
id: technical-decision
name: Technical Decision
description: >
  Multi-track analysis for evaluating build/buy decisions, migration
  strategies, and technology choices. Each track composes lenses that
  build on each other, ending with a counterbalance that challenges the
  track's direction. Covers decision economics, migration risk, and
  paradigm fit.

tracks:
  decision:
    lenses: [build-vs-buy, dependency-risk, reversibility, constraints]
    focus: "What's the true cost of each path, what dependencies does it create, can we reverse it? THEN: does the binding constraint make the decision for us regardless?"
  migration:
    lenses: [migration, blast-radius, error-budgets, occams-razor]
    focus: "How do we transition safely, what's the blast radius if it goes wrong, how much risk can we budget? THEN: is incremental migration worth the dual-running complexity?"
  paradigm:
    lenses: [functional, domain-modeling, event-driven, kiss]
    focus: "What does each paradigm reveal about the approach? THEN: is paradigm purity helping or adding accidental complexity?"
```

- [ ] **Step 2: Verify the strategy loads correctly**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add strategies/technical-decision.yaml
git commit -m "feat: add technical-decision strategy"
```

## Chunk 6: Validation tests

### Task 20: Write validation tests for new models and strategies

**Files:**
- Modify: `tests/loader.test.ts`

- [ ] **Step 1: Add validation test for all 15 new models loading from built-in directory**

Add a new `describe` block to `tests/loader.test.ts`:

```typescript
describe("new dev/engineering models", () => {
  let allModels: Awaited<ReturnType<typeof loadModelsFromDirectory>>;

  beforeAll(async () => {
    const builtinDir = path.join(__dirname, "..", "models");
    allModels = await loadModelsFromDirectory(builtinDir);
  });

  const newModelIds = [
    "state-ownership",
    "error-propagation",
    "contract-boundaries",
    "data-transformation-fidelity",
    "build-vs-buy",
    "dependency-risk",
    "migration",
    "observability-gaps",
    "error-budgets",
    "graceful-degradation",
    "back-pressure",
    "operational-complexity",
    "functional",
    "domain-modeling",
    "event-driven",
  ];

  it.each(newModelIds)("loads model '%s' with all required fields", (modelId) => {
    const model = allModels.find((m) => m.id === modelId);
    expect(model, `model '${modelId}' not found`).toBeDefined();
    expect(model!.name).toBeTruthy();
    expect(model!.tags.length).toBeGreaterThan(0);
    expect(model!.description).toBeTruthy();
    expect(model!.guiding_questions.length).toBeGreaterThan(0);
    expect(Object.keys(model!.required_fields).length).toBeGreaterThan(0);

    // Every required field has description and hint
    for (const [key, field] of Object.entries(model!.required_fields)) {
      expect(field.description, `${modelId}.${key} missing description`).toBeTruthy();
      expect(field.hint, `${modelId}.${key} missing hint`).toBeTruthy();
    }

    // Has at least one related model
    expect(model!.related_models.length, `${modelId} has no related_models`).toBeGreaterThan(0);

    // Has at least one counterbalance
    expect(model!.counterbalances.length, `${modelId} has no counterbalances`).toBeGreaterThan(0);
  });

  it("places models in correct categories", () => {
    const categoryMap: Record<string, string> = {
      "state-ownership": "architecture",
      "error-propagation": "architecture",
      "contract-boundaries": "architecture",
      "data-transformation-fidelity": "architecture",
      "build-vs-buy": "reasoning",
      "dependency-risk": "reasoning",
      "migration": "operations",
      "observability-gaps": "reliability",
      "error-budgets": "reliability",
      "graceful-degradation": "reliability",
      "back-pressure": "reliability",
      "operational-complexity": "reliability",
      "functional": "paradigms",
      "domain-modeling": "paradigms",
      "event-driven": "paradigms",
    };

    for (const [modelId, expectedCategory] of Object.entries(categoryMap)) {
      const model = allModels.find((m) => m.id === modelId);
      expect(model!.category, `${modelId} in wrong category`).toBe(expectedCategory);
    }
  });

  it("all related_models and counterbalances reference valid model IDs", () => {
    const allIds = new Set(allModels.map((m) => m.id));

    for (const modelId of newModelIds) {
      const model = allModels.find((m) => m.id === modelId)!;

      for (const rel of model.related_models) {
        expect(allIds.has(rel.id), `${modelId} references unknown related model '${rel.id}'`).toBe(true);
      }
      for (const cb of model.counterbalances) {
        expect(allIds.has(cb.id), `${modelId} references unknown counterbalance '${cb.id}'`).toBe(true);
      }
    }
  });
});
```

Add `import { beforeAll } from "vitest";` to the existing import line at the top of the file.

- [ ] **Step 2: Run the tests**

Run: `npx vitest run tests/loader.test.ts`
Expected: All tests PASS including the new validation tests.

- [ ] **Step 3: Add strategy validation test**

Add to the same file or create a separate test. Add to `tests/loader.test.ts`:

```typescript
import { loadStrategiesFromDirectory } from "../src/loader.js";

describe("strategy updates and new strategy", () => {
  let allStrategies: Awaited<ReturnType<typeof loadStrategiesFromDirectory>>;
  let allModels: Awaited<ReturnType<typeof loadModelsFromDirectory>>;

  beforeAll(async () => {
    const builtinModelsDir = path.join(__dirname, "..", "models");
    const builtinStrategiesDir = path.join(__dirname, "..", "strategies");
    allModels = await loadModelsFromDirectory(builtinModelsDir);
    allStrategies = await loadStrategiesFromDirectory(builtinStrategiesDir);
  });

  it("technical-decision strategy exists with 3 tracks", () => {
    const strategy = allStrategies.find((s) => s.id === "technical-decision");
    expect(strategy).toBeDefined();
    expect(Object.keys(strategy!.tracks)).toEqual(["decision", "migration", "paradigm"]);
  });

  it("system-design strategy has data-flow and operational-readiness tracks", () => {
    const strategy = allStrategies.find((s) => s.id === "system-design");
    expect(strategy!.tracks["data-flow"]).toBeDefined();
    expect(strategy!.tracks["operational-readiness"]).toBeDefined();
  });

  it("code-review strategy has data-and-state track", () => {
    const strategy = allStrategies.find((s) => s.id === "code-review");
    expect(strategy!.tracks["data-and-state"]).toBeDefined();
  });

  it("incident-investigation strategy has observability track", () => {
    const strategy = allStrategies.find((s) => s.id === "incident-investigation");
    expect(strategy!.tracks["observability"]).toBeDefined();
  });

  it("all strategy track lenses reference valid model IDs", () => {
    const allModelIds = new Set(allModels.map((m) => m.id));

    for (const strategy of allStrategies) {
      for (const [trackName, track] of Object.entries(strategy.tracks)) {
        for (const lensId of track.lenses) {
          expect(
            allModelIds.has(lensId),
            `Strategy '${strategy.id}' track '${trackName}' references unknown model '${lensId}'`
          ).toBe(true);
        }
      }
    }
  });
});
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add tests/loader.test.ts
git commit -m "test: add validation tests for new models and strategy updates"
```
