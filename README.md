# systems-thinking-mcp

An MCP server that provides systems thinking models as composable analysis lenses for planning, architecture, and troubleshooting.

Inspired by [@modelcontextprotocol/server-sequential-thinking](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking). Where sequential-thinking emphasizes **rigor** — structured step-by-step reasoning with revision and branching — this tool emphasizes **abstraction**. It provides a library of mental models (feedback loops, constraint analysis, inversion, etc.) that shift your perspective on a problem. The two are complementary: use sequential-thinking to reason carefully through a problem, use systems-thinking to ensure you're looking at it from the right angles.

## How it works

Three tools with a lifecycle: **start** a session, **apply** 2-4 lenses from different perspectives, then **synthesize** across them.

The value isn't in any single lens — it's in the composition. Each model surfaces things the others miss, and the server tracks cross-references between findings automatically. When you apply constraint analysis and then queuing theory, the server connects "database write throughput is the bottleneck" from the first lens to "arrival rate exceeds service rate" in the second.

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
| **start_analysis** | Frame a problem. Returns suggested lenses and a recommended sequence of 3 models (including counterbalances). |
| **apply_lens** | Apply a model to the problem. Returns cross-references to prior findings, counterbalance suggestions, analysis depth indicator, and complementary next lenses. |
| **synthesize** | Integrate findings across all applied lenses. Returns cross-lens connections found, and suggestions for additional lenses to fill gaps. |

## Models (37)

| Category | Models |
|---|---|
| Architecture | Modularity, Coupling & Cohesion, Conway's Law, Failure Modes, KISS, Separation of Concerns, Idempotency, Blast Radius |
| Dynamics | Source & Sink, System Dynamics, Feedback & Feedforward Loops, Stock & Flow, Causal Loop Diagrams |
| Operations | Queuing Theory, Buffers & Buffer Sizing, Constraint Analysis, Leverage Points |
| Reasoning | Inversion, Second-Order Thinking, Map vs Territory, Circle of Competence, Occam's Razor, Margin of Safety, Reversibility, Hanlon's Razor |
| Schema | Normalization, Denormalization |
| Security | CIA Triad, Least Privilege, Attack Surface, Defense in Depth, Trust Boundaries |
| Troubleshooting | Bottom-Up, Top-Down, Binary Search, Parallelism, Caches |

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
