#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "path";
import { fileURLToPath } from "url";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import { loadModels, loadStrategies, validateStrategyReferences } from "./loader.js";
import { SystemsThinkingServer } from "./server.js";
import { computeClusters } from "./matcher.js";
import { StartAnalysisInput, ApplyLensInput, ExpandSelectionInput, SynthesizeInput, GetStrategyInput } from "./types.js";
import type { StrategyDefinition } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = await yargs(hideBin(process.argv))
  .option("models-dir", {
    type: "string",
    description: "Additional models directory (overlays built-in models)",
  })
  .parse();

const builtinModelsDir = path.join(__dirname, "..", "models");
const customModelsDir = argv.modelsDir as string | undefined;

const models = await loadModels(builtinModelsDir, customModelsDir);

const builtinStrategiesDir = path.join(__dirname, "..", "strategies");
const strategies = await loadStrategies(builtinStrategiesDir, customModelsDir);
const strategyMap = new Map<string, StrategyDefinition>(strategies.map((s) => [s.id, s]));

// Validate strategy concern domains reference valid categories
const categoryNames = new Set(models.map((m) => m.category));
const validationErrors = validateStrategyReferences(strategies, categoryNames);
if (validationErrors.length > 0) {
  for (const err of validationErrors) {
    console.error(chalk.red(`VALIDATION ERROR: ${err}`));
  }
  process.exit(1);
}

const disableLogging = process.env.DISABLE_THOUGHT_LOGGING === "true";

if (!disableLogging) {
  console.error(
    chalk.blue(`Systems Thinking MCP Server loaded ${models.length} models, ${strategies.length} strategies`)
  );
  for (const m of models) {
    console.error(chalk.gray(`  [${m.category}] ${m.name} (${m.id})`));
  }
  for (const s of strategies) {
    console.error(chalk.gray(`  {strategy} ${s.name} (${s.id}) — ${s.concerns.length} concerns`));
  }
}

const thinkingServer = new SystemsThinkingServer(models);

const mcpServer = new McpServer({
  name: "systems-thinking-mcp",
  version: "0.1.0",
});

// --- Tool: start_analysis ---

mcpServer.registerTool("start_analysis", {
  title: "Start Analysis",
  description: `Begin a systems thinking analysis session. Returns model clusters organized by category for you to review and select from.

BEFORE calling this, consider whether a predefined strategy fits your use case. Call get_strategy (with no arguments) to see available strategies.

THE EXPECTED WORKFLOW IS:
1. start_analysis → review clusters, pick relevant models
2. expand_selection → get full details + graph neighbors for your picks
3. apply_lens (2-4 times) → apply your chosen lenses
4. synthesize → integrate findings

The value is in COMPOSING multiple perspectives. Apply at least 2-3 lenses before synthesizing.`,
  inputSchema: StartAnalysisInput,
}, async (args) => {
  const result = thinkingServer.startAnalysis(args);

  if (!disableLogging) {
    console.error(chalk.blue("\n━━━ New Analysis Session ━━━"));
    console.error(chalk.white(`Problem: ${result.problem}`));
    console.error(
      chalk.gray(
        `Clusters: ${result.clusters.map((c) => `${c.id} (${c.modelIds.length})`).join(", ")}`
      )
    );
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
});

// --- Tool: expand_selection ---

mcpServer.registerTool("expand_selection", {
  title: "Expand Selection",
  description: `Get full details for selected models plus their graph neighbors and counterbalances.

Call after start_analysis with the model IDs you've chosen. Returns:
- Full model details (guiding questions, required fields) for your selection
- Graph neighbors (related models one hop away) with relationship reasons
- Counterbalances (opposing perspectives) with tension descriptions
- Uncovered categories to highlight analytical gaps

Use this to review your selection before committing to apply_lens calls.`,
  inputSchema: ExpandSelectionInput,
}, async (args) => {
  const result = thinkingServer.expandSelection(args);

  if (!disableLogging) {
    if (result.error) {
      console.error(chalk.red(`\n✗ ${result.error}`));
    } else {
      console.error(chalk.blue(`\n📋 Expanded: ${args.modelIds.join(", ")}`));
      console.error(chalk.gray(`   Neighbors: ${result.graphNeighbors?.map((n) => n.modelId).join(", ") || "none"}`));
      console.error(chalk.gray(`   Counterbalances: ${result.counterbalances?.map((c) => c.modelId).join(", ") || "none"}`));
    }
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
});

// --- Tool: apply_lens ---

mcpServer.registerTool("apply_lens", {
  title: "Apply Lens",
  description: `Apply a systems thinking model to the current problem.

IMPORTANT: The "analysis" parameter is your narrative analysis text. The "findings" parameter is a JSON object where keys are the model's required field names and values are your findings for each. Do NOT pass finding fields as top-level parameters — they must be nested inside the "findings" object.

Example call structure:
{
  "sessionId": "abc123",
  "modelId": "stock-and-flow",
  "analysis": "Your narrative analysis through this lens...",
  "findings": {
    "stocks": "Your finding about stocks...",
    "inflows": "Your finding about inflows...",
    "outflows": "Your finding about outflows...",
    "equilibrium_analysis": "Your finding about equilibrium..."
  }
}

Available models: ${models.map((m) => `${m.id} (${m.name})`).join(", ")}

IMPORTANT: Do NOT stop after one lens. Apply 2-4 lenses per session to get genuine multi-perspective insight. The response includes prior findings from earlier lenses — use these to identify connections and build on previous analysis. When you've built enough perspective, call synthesize to integrate across lenses.

Can be called multiple times per session. Allowed after synthesize.`,
  inputSchema: ApplyLensInput,
}, async (args) => {
  const result = thinkingServer.applyLens(args);

  if (!disableLogging) {
    if (result.error) {
      console.error(chalk.red(`\n✗ ${result.error}`));
    } else {
      console.error(chalk.green(`\n🔍 Applied: ${result.modelId}`));
      if (result.missingFields && result.missingFields.length > 0) {
        console.error(
          chalk.yellow(`   Missing fields: ${result.missingFields.join(", ")}`)
        );
      }
      if (result.priorFindings && result.priorFindings.length > 0) {
        console.error(
          chalk.cyan(
            `   Prior lenses: ${result.priorFindings.map((p) => p.modelId).join(", ")}`
          )
        );
      }
    }
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
});

// --- Tool: synthesize ---

mcpServer.registerTool("synthesize", {
  title: "Synthesize",
  description: `Synthesize findings across all applied lenses into a unified view. This is the payoff — where cross-lens connections become actionable insight.

Call after applying 2+ lenses. Your synthesis should integrate findings across lenses: where did different perspectives agree (reinforcing confidence), where did they contradict (revealing tension), and what gaps remain? The best syntheses surface connections that no single lens would have found.

Provide concrete, actionable recommendations grounded in the multi-lens evidence. Note contradictions explicitly — they often point to the most important design tensions. Note gaps — they suggest which lenses to apply next if deeper analysis is needed.

The session stays open after synthesis. If the synthesis reveals gaps, apply more lenses and synthesize again.`,
  inputSchema: SynthesizeInput,
}, async (args) => {
  const result = thinkingServer.synthesize(args);

  if (!disableLogging) {
    if (result.error) {
      console.error(chalk.red(`\n✗ ${result.error}`));
    } else {
      console.error(chalk.magenta("\n━━━ Synthesis ━━━"));
      console.error(
        chalk.white(
          `Lenses: ${result.lensesApplied?.map((l) => l.modelId).join(" → ") || "none"}`
        )
      );
      console.error(
        chalk.white(
          `Recommendations: ${result.recommendations?.length || 0}`
        )
      );
      if (result.warning) {
        console.error(chalk.yellow(`⚠ ${result.warning}`));
      }
    }
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
});

// --- Tool: get_strategy ---

mcpServer.registerTool("get_strategy", {
  title: "Get Strategy",
  description: `Get a predefined analysis strategy. Strategies define which concerns to cover and how to approach them, without prescribing specific models.

Available strategies: ${strategies.map((s) => `${s.id} (${s.name})`).join(", ")}

Call without strategyId to list all strategies. Call with a strategyId to get the concern map.

USAGE: Get a strategy, then for each concern: evaluate relevance to your specific problem, use expand_selection with models from that concern's domain, pick appropriate lenses, and apply them. Concerns marked "required" should always be evaluated. "Conditional" concerns depend on the scale and nature of the change. Each concern can be run in parallel as an independent analysis track.`,
  inputSchema: GetStrategyInput,
}, async (args) => {
  if (!args.strategyId) {
    // List all strategies
    const list = strategies.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      concernCount: s.concerns.length,
      concerns: s.concerns.map((c) => ({
        domain: c.domain,
        focus: c.focus,
        weight: c.weight,
      })),
    }));
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ strategies: list }, null, 2) }],
    };
  }

  const strategy = strategyMap.get(args.strategyId);
  if (!strategy) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        error: `Strategy not found: ${args.strategyId}`,
        availableStrategies: strategies.map((s) => s.id),
      }, null, 2) }],
    };
  }

  // Enrich concerns with cluster info (available models in each domain)
  const clusters = computeClusters(models);
  const clusterMap = new Map(clusters.map((c) => [c.id, c]));

  const enrichedConcerns = strategy.concerns.map((concern) => {
    const cluster = clusterMap.get(concern.domain);
    return {
      domain: concern.domain,
      focus: concern.focus,
      weight: concern.weight,
      availableModels: cluster
        ? cluster.modelIds.map((id) => {
            const m = thinkingServer.getModel(id);
            return m ? { id: m.id, name: m.name, description: m.description.trim().slice(0, 100) } : { id, name: id };
          })
        : [],
    };
  });

  return {
    content: [{ type: "text" as const, text: JSON.stringify({
      strategy: {
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
      },
      concerns: enrichedConcerns,
      workflow: `For each concern: evaluate relevance to your problem (required = always, conditional = depends on scale/nature). Use expand_selection with chosen models from the concern's domain, then apply_lens. Concerns can be run in parallel.`,
    }, null, 2) }],
  };
});

// --- Start server ---

async function runServer() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  if (!disableLogging) {
    console.error("Systems Thinking MCP Server running on stdio");
  }
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
