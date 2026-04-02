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

// Validate strategy→model references at startup
const modelIds = new Set(models.map((m) => m.id));
const validationErrors = validateStrategyReferences(strategies, modelIds);
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
    console.error(chalk.gray(`  {strategy} ${s.name} (${s.id}) — ${Object.keys(s.tracks).length} tracks`));
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
  description: `Get a predefined multi-track analysis strategy. Strategies define parallel analysis tracks, each with 2-3 focused lenses.

Available strategies: ${strategies.map((s) => `${s.id} (${s.name})`).join(", ")}

Call without strategyId to list all strategies. Call with a strategyId to get the full playbook.

USAGE: Get a strategy, then run each track as a separate analysis session (or in parallel with subagents). Each track calls start_analysis → apply_lens (for each lens in the track) → synthesize. After all tracks complete, do a final cross-track synthesis combining findings from all tracks.

This is the recommended approach for broad analysis (code review, system design, security audit) where multiple independent perspectives are more valuable than a single sequential chain.`,
  inputSchema: GetStrategyInput,
}, async (args) => {
  if (!args.strategyId) {
    // List all strategies
    const list = strategies.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      trackCount: Object.keys(s.tracks).length,
      tracks: Object.entries(s.tracks).map(([name, track]) => ({
        name,
        lensCount: track.lenses.length,
        focus: track.focus,
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

  // Enrich tracks with full model info
  const enrichedTracks = Object.entries(strategy.tracks).map(([trackName, track]) => ({
    trackName,
    focus: track.focus,
    lenses: track.lenses.map((id) => {
      const model = thinkingServer.getModel(id);
      return model
        ? { modelId: model.id, name: model.name, guidingQuestions: model.guiding_questions, requiredFields: model.required_fields }
        : { modelId: id, name: id, error: "Model not found" };
    }),
  }));

  return {
    content: [{ type: "text" as const, text: JSON.stringify({
      strategy: {
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
      },
      tracks: enrichedTracks,
      workflow: `Run each track as a separate analysis session (or in parallel). For each track: start_analysis → apply_lens for each lens → synthesize. Then do a final synthesis combining all track findings.`,
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
