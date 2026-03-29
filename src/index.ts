#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "path";
import { fileURLToPath } from "url";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import { loadModels } from "./loader.js";
import { SystemsThinkingServer } from "./server.js";
import { StartAnalysisInput, ApplyLensInput, SynthesizeInput } from "./types.js";

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
const disableLogging = process.env.DISABLE_THOUGHT_LOGGING === "true";

if (!disableLogging) {
  console.error(
    chalk.blue(`Systems Thinking MCP Server loaded ${models.length} models`)
  );
  for (const m of models) {
    console.error(chalk.gray(`  [${m.category}] ${m.name} (${m.id})`));
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
  description: `Begin a systems thinking analysis session. Frames the problem and suggests relevant analytical lenses.

Call this first to establish the problem context. Returns a sessionId and suggested lenses (with their guiding questions and required fields) based on keyword matching against your problem description.

After starting, use apply_lens to examine the problem through specific models, then synthesize to integrate findings.`,
  inputSchema: StartAnalysisInput,
}, async (args) => {
  const result = thinkingServer.startAnalysis(args);

  if (!disableLogging) {
    console.error(chalk.blue("\n━━━ New Analysis Session ━━━"));
    console.error(chalk.white(`Problem: ${result.problem}`));
    console.error(
      chalk.gray(
        `Suggested: ${result.suggestedLenses.map((s) => s.name).join(", ") || "none"}`
      )
    );
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
      if (result.crossReferences && result.crossReferences.length > 0) {
        console.error(
          chalk.cyan(
            `   Cross-refs: ${result.crossReferences.map((r) => `${r.fromLens}/${r.findingKey}`).join(", ")}`
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
  description: `Synthesize findings across all applied lenses into a unified view.

Call after applying one or more lenses. Provide your cross-lens integration, recommendations, and note any contradictions or gaps between lenses.

Returns the full session (all lenses and findings) plus suggestions for additional lenses that might address identified gaps.

Allowed with zero lenses (returns a warning). The session stays open after synthesis — you can apply more lenses and synthesize again.`,
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
