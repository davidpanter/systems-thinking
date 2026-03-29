# Systems Thinking MCP Server — Design Specification

## Overview

An MCP server that provides a library of systems thinking models as structured lenses for analyzing architecture, dynamics, operations, and troubleshooting. Claude applies these lenses during planning and debugging to gain structured perspectives on complex problems. The output is equally useful to the human reading along.

Modeled after `@modelcontextprotocol/server-sequential-thinking` — lightweight TypeScript, stdio transport, in-memory state, minimal dependencies.

## Tools

Three tools with a lifecycle protocol: **start → apply → synthesize**.

### `start_analysis`

Frames the problem and creates a session.

**Input:**
- `problem` (string, required) — what are we analyzing/troubleshooting?
- `context` (string, optional) — system description, constraints, environment
- `scope` (string, optional) — what's in/out of bounds

**Output:**
- `sessionId` — unique session identifier
- `problem` — restated problem for confirmation
- `suggestedLenses` — array of `{ modelId, name, reason }` matched by keyword/tag analysis against the problem description

### `apply_lens`

Applies a named model to the problem. Called multiple times per session to build up a composable analysis.

**Input:**
- `sessionId` (string, required)
- `modelId` (string, required) — e.g. "queuing-theory", "bottom-up"
- `analysis` (string, required) — Claude's analysis through this lens
- `findings` (Record<string, string>, required) — model-specific required fields as defined in the model YAML
- `observations` (string, optional) — emergent insights outside the template
- `confidence` (enum: "low" | "medium" | "high", optional)
- `nextLens` (string, optional) — what Claude wants to apply next

**Output:**
- `modelId` — confirmed model applied
- `guidingQuestions` — the model's guiding questions (returned on each call for reference)
- `requiredFields` — the model's expected findings fields with descriptions and hints
- `missingFields` — any required fields not provided (soft reminder, not rejection)
- `crossReferences` — connections to prior lens findings (keyword-matched)
- `suggestedNextLenses` — 1-3 suggestions from `related_models` + tag matching, excluding already-applied lenses
- `sessionSummary` — current session state (problem, lenses applied so far)

### `synthesize`

Pulls insights across all applied lenses into a unified view.

**Input:**
- `sessionId` (string, required)
- `synthesis` (string, required) — Claude's cross-lens integration
- `recommendations` (string[], required) — actionable outcomes
- `contradictions` (string, optional) — where lenses disagreed
- `gaps` (string, optional) — what wasn't examined

**Output:**
- `sessionId`
- `problem` — original problem statement
- `lensesApplied` — array of all lens applications with findings
- `synthesis` — Claude's synthesis text
- `recommendations` — the recommendation set
- `contradictions` — noted contradictions
- `gaps` — noted gaps
- `suggestedAdditionalLenses` — models that might fill identified gaps

## Model Definition Format

Each model is a YAML file. The category is determined by the directory it lives in. Models are discovered at startup by scanning all `.yaml` files recursively.

```yaml
id: constraints                    # Unique identifier, used in apply_lens
name: Constraint Analysis          # Human-readable name
category: operations               # Set by directory, echoed here for portability
tags: [bottleneck, throughput, capacity, troubleshooting, planning]
description: >
  Identify the binding constraint that limits overall system throughput.
  Based on Theory of Constraints.

guiding_questions:
  - What is the desired output/throughput of this system?
  - Where does work pile up or wait?
  - Which component, if improved, would improve the whole system?
  - Are there constraints we're working around without realizing it?
  - Is this constraint physical, policy-based, or market-based?

required_fields:
  identified_constraints:
    description: List of constraints found, ranked by impact
    hint: "Include both obvious bottlenecks and hidden policy constraints"
  binding_constraint:
    description: The single constraint currently limiting the system
    hint: "There's usually one that dominates — which is it?"
  exploitation:
    description: How to maximize throughput without changing the constraint
    hint: "Before adding capacity, are we fully using what we have?"
  elevation:
    description: How to increase capacity of the constraint itself
    hint: "What would it take to remove this as the bottleneck?"
  subordination:
    description: How other components should adapt to the constraint
    hint: "Non-bottlenecks producing faster than the constraint just creates inventory"

related_models:
  - id: queuing-theory
    reason: "Queuing analysis can quantify the wait times at the constraint"
  - id: buffers
    reason: "Buffer sizing protects the constraint from starvation"
  - id: leverage-points
    reason: "The binding constraint is often a high-leverage intervention point"
```

## Model Library

### Architecture (4 models)

| ID | Name | Tags |
|---|---|---|
| `modularity` | Modularity | boundaries, decomposition, interfaces, planning |
| `coupling-cohesion` | Coupling & Cohesion | dependencies, isolation, refactoring, planning |
| `conways-law` | Conway's Law | organization, communication, team-structure, planning |
| `failure-modes` | Failure Modes | resilience, cascading, fault-tolerance, risk |

### Dynamics (5 models)

| ID | Name | Tags |
|---|---|---|
| `source-sink` | Source & Sink | data-flow, inputs, outputs, lifecycle |
| `system-dynamics` | System Dynamics | temporal, behavior, trends, prediction |
| `feedback-loops` | Feedback & Feedforward Loops | amplification, stabilization, control, regulation |
| `stock-and-flow` | Stock & Flow | accumulation, rates, inventory, capacity |
| `causal-loop-diagrams` | Causal Loop Diagrams | causality, visualization, feedback, mental-models |

### Operations (4 models)

| ID | Name | Tags |
|---|---|---|
| `queuing-theory` | Queuing Theory | throughput, latency, waiting, load |
| `buffers` | Buffers & Buffer Sizing | capacity, overflow, starvation, resilience |
| `constraints` | Constraint Analysis | bottleneck, throughput, capacity, planning |
| `leverage-points` | Leverage Points | intervention, impact, efficiency, strategy |

### Troubleshooting (5 models)

| ID | Name | Tags |
|---|---|---|
| `bottom-up` | Bottom-Up | infrastructure, dependencies, assumptions, diagnostic |
| `top-down` | Top-Down | pipeline, upstream, inputs, diagnostic |
| `binary-search` | Binary Search | isolation, elimination, efficiency, diagnostic |
| `parallelism` | Parallelism | concurrency, deadlock, race-condition, diagnostic |
| `caches` | Caches | staleness, invalidation, ttl, layers, diagnostic |

## Project Structure

```
systems-thinking/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # MCP server entry, tool registration
│   ├── server.ts             # SystemsThinkingServer class (state, session mgmt)
│   ├── loader.ts             # Discovers and loads model definitions from YAML
│   └── types.ts              # Shared types
├── models/
│   ├── architecture/
│   │   ├── modularity.yaml
│   │   ├── coupling-cohesion.yaml
│   │   ├── conways-law.yaml
│   │   └── failure-modes.yaml
│   ├── dynamics/
│   │   ├── source-sink.yaml
│   │   ├── system-dynamics.yaml
│   │   ├── feedback-loops.yaml
│   │   ├── stock-and-flow.yaml
│   │   └── causal-loop-diagrams.yaml
│   ├── operations/
│   │   ├── queuing-theory.yaml
│   │   ├── buffers.yaml
│   │   ├── constraints.yaml
│   │   └── leverage-points.yaml
│   └── troubleshooting/
│       ├── bottom-up.yaml
│       ├── top-down.yaml
│       ├── binary-search.yaml
│       ├── parallelism.yaml
│       └── caches.yaml
└── dist/
```

## Session State

```typescript
interface Session {
  id: string;
  problem: string;
  context?: string;
  scope?: string;
  lenses: LensApplication[];
  startedAt: number;
}

interface LensApplication {
  modelId: string;
  analysis: string;
  findings: Record<string, string>;
  observations?: string;
  confidence?: "low" | "medium" | "high";
  appliedAt: number;
}
```

## Cross-Lens Intelligence

The server performs lightweight keyword matching across accumulated findings:

1. **On each `apply_lens` call** — scans prior findings values for terms that appear in the current model's `required_fields` descriptions and `guiding_questions`. Returns matches as `crossReferences`.
2. **Suggested next lenses** — combines the current model's `related_models` with tag-matching against the problem description. Filters out already-applied lenses. Returns 1-3 suggestions with reasons.
3. **On `synthesize`** — returns the full session with a structured prompt nudging Claude to identify agreements, contradictions, and gaps across lenses.

Cross-referencing is keyword-based and simple. False positives are cheap; missed connections are expensive.

## Extensibility

- **Custom models directory** — `--models-dir /path/to/models` CLI flag. Custom models overlay built-ins; same `id` = custom wins.
- **No code changes needed** — drop a YAML file following the format, restart the server.
- **Category from directory** — the subdirectory name under `models/` is the category.

## Configuration

```json
// ~/.claude.json
"systems-thinking": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "systems-thinking-server"],
  "env": {}
}
```

With custom models:
```json
"systems-thinking": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "systems-thinking-server", "--models-dir", "/path/to/models"],
  "env": {}
}
```

## Explicit Non-Goals

- No web UI
- No persistence across server restarts
- No LLM calls from the server
- No model versioning
- No authentication or multi-user support
- No automatic analysis — Claude does all the thinking

## Dependencies

- `@modelcontextprotocol/sdk` — MCP protocol
- `js-yaml` — YAML parsing for model definitions
- `chalk` — terminal styling for stderr logging
- `yargs` — CLI argument parsing
- `zod` — input validation
