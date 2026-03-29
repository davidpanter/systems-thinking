# systems-thinking-mcp

MCP server providing systems thinking models as composable analysis lenses.

## Install

```json
// ~/.claude.json
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
git clone <repo-url>
cd systems-thinking
npm install && npm run build
```

Then in `~/.claude.json`:

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

- **start_analysis** — Frame a problem, get suggested lenses
- **apply_lens** — Apply a model (e.g., constraint analysis, queuing theory) to the problem
- **synthesize** — Integrate findings across lenses

## Models (18)

| Category | Models |
|---|---|
| Architecture | Modularity, Coupling & Cohesion, Conway's Law, Failure Modes |
| Dynamics | Source & Sink, System Dynamics, Feedback Loops, Stock & Flow, Causal Loop Diagrams |
| Operations | Queuing Theory, Buffers, Constraint Analysis, Leverage Points |
| Troubleshooting | Bottom-Up, Top-Down, Binary Search, Parallelism, Caches |

## Custom Models

Add models via `--models-dir`:

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

Models are YAML files in category subdirectories. See `models/` for examples.

## Environment Variables

- `DISABLE_THOUGHT_LOGGING=true` — suppress stderr logging of model loading and lens application
