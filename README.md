# systems-thinking-mcp

An MCP server that provides systems thinking models as composable analysis lenses for planning, architecture, and troubleshooting.

Inspired by [@modelcontextprotocol/server-sequential-thinking](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking). Where sequential-thinking emphasizes **rigor** — structured step-by-step reasoning with revision and branching — this tool emphasizes **abstraction**. It provides a library of mental models (feedback loops, constraint analysis, inversion, etc.) that shift your perspective on a problem. The two are complementary: use sequential-thinking to reason carefully through a problem, use systems-thinking to ensure you're looking at it from the right angles.

## How it works

Five tools with a lifecycle: **start** a session (returns model clusters by category), **expand** your selection (get full model details and graph neighbors), **apply** 2-4 lenses from different perspectives, then **synthesize** across them.

The value isn't in any single lens — it's in the composition. Each model surfaces things the others miss, and the server provides prior findings from earlier lenses so the LLM can judge connections between them. When you apply constraint analysis and then queuing theory, the findings from the first lens are available when applying the second.

Models also define **counterbalances** — deliberately opposing perspectives. When you apply leverage-points, the server suggests KISS as a counterbalance: *"The simplest solution may miss high-leverage structural changes that pay off long-term."* This productive tension prevents single-framework tunnel vision.

## Install

```json
{
  "mcpServers": {
    "systems-thinking": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "systems-thinking-mcp"]
    }
  }
}
```

Or run locally:

```bash
git clone https://github.com/davidpanter/systems-thinking.git
cd systems-thinking
npm install && npm run build
```

```json
{
  "mcpServers": {
    "systems-thinking": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/systems-thinking/dist/index.js"]
    }
  }
}
```

## Tools

| Tool | Purpose |
|---|---|
| **start_analysis** | Frame a problem. Returns model clusters grouped by category for selection. |
| **expand_selection** | Takes model IDs. Returns full model details, graph neighbors, counterbalances, and uncovered categories. |
| **apply_lens** | Apply a model to the problem. Returns prior findings from earlier lenses, counterbalance suggestions, analysis depth indicator, and complementary next lenses. |
| **synthesize** | Integrate findings across all applied lenses. Suggests additional lenses to fill gaps. |
| **get_strategy** | Returns a concern map (domain, focus, weight) for a named strategy, guiding which categories to prioritize. |

## Models (53)

| Category | Models |
|---|---|
| Architecture | Modularity, Coupling & Cohesion, Conway's Law, Failure Modes, KISS, Separation of Concerns, Idempotency, Blast Radius, State Ownership, Error Propagation, Contract Boundaries, Data Transformation Fidelity |
| Dynamics | Source & Sink, System Dynamics, Feedback & Feedforward Loops, Stock & Flow, Causal Loop Diagrams |
| Operations | Queuing Theory, Buffers & Buffer Sizing, Constraint Analysis, Leverage Points, Migration |
| Paradigms | Functional Lens, Domain Modeling Lens, Event-Driven Lens |
| Reasoning | Inversion, Second-Order Thinking, Map vs Territory, Circle of Competence, Occam's Razor, Margin of Safety, Reversibility, Hanlon's Razor, Build vs. Buy, Dependency Risk |
| Reliability | Observability Gaps, Error Budgets, Graceful Degradation, Back Pressure, Operational Complexity |
| Schema | Normalization, Denormalization |
| Security | CIA Triad, Least Privilege, Attack Surface, Defense in Depth, Trust Boundaries |
| Troubleshooting | Bottom-Up, Top-Down, Binary Search, Parallelism, Caches, What's Changed |

Models support multi-facet categories via a `categories` array in YAML, allowing a single model to appear in multiple categories.

## Strategies (6)

Strategies guide the LLM toward the right categories for a given task. Each strategy defines a concern map -- a list of domains (matching category names) with a focus question and weight (`required`, `conditional`, `optional`). Strategy-to-model validation runs at startup, ensuring concern domains match actual category names.

| Strategy | Description |
|---|---|
| **system-design** | Designing or evaluating system architecture |
| **code-review** | Reviewing code changes for structural and operational issues |
| **incident-investigation** | Diagnosing production incidents |
| **security-audit** | Evaluating security posture |
| **capacity-planning** | Planning for load, growth, and resource constraints |
| **technical-decision** | Evaluating build/buy, migration, and technology choices |

## Custom models

Add your own models via `--models-dir`. Custom models with the same ID as built-in models override them.

```json
{
  "mcpServers": {
    "systems-thinking": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "systems-thinking-mcp", "--models-dir", "/path/to/models"]
    }
  }
}
```

Models are YAML files in category subdirectories. See `models/` for the format.

## Environment variables

- `DISABLE_THOUGHT_LOGGING=true` — suppress stderr logging
