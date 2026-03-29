# Systems Thinking MCP Server Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript MCP server that provides 18 systems thinking models as composable analysis lenses with session state and cross-lens intelligence.

**Architecture:** Three MCP tools (`start_analysis`, `apply_lens`, `synthesize`) backed by a `SystemsThinkingServer` class managing in-memory sessions. Model definitions live in YAML files organized by category directory. A loader discovers models at startup; a matcher provides keyword-based cross-referencing and lens suggestions.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `js-yaml`, `zod`, `chalk`, `yargs`, `vitest`

**Spec:** `docs/superpowers/specs/2026-03-29-systems-thinking-mcp-design.md`

---

## File Map

| File | Responsibility |
|---|---|
| `package.json` | Package metadata, dependencies, scripts |
| `tsconfig.json` | TypeScript config (ESM, strict) |
| `src/types.ts` | All shared TypeScript interfaces and Zod schemas |
| `src/loader.ts` | Discover and parse YAML model files from directories |
| `src/matcher.ts` | Keyword matching for suggestions and cross-references |
| `src/server.ts` | `SystemsThinkingServer` class — session state, lens application, synthesis |
| `src/index.ts` | MCP server entry — tool registration, stdio transport |
| `models/architecture/*.yaml` | 4 architecture model definitions |
| `models/dynamics/*.yaml` | 5 dynamics model definitions |
| `models/operations/*.yaml` | 4 operations model definitions |
| `models/troubleshooting/*.yaml` | 5 troubleshooting model definitions |
| `tests/loader.test.ts` | YAML parsing, directory scanning, overlay behavior |
| `tests/matcher.test.ts` | Keyword matching for suggestions and cross-refs |
| `tests/server.test.ts` | Session lifecycle, error cases, cross-references |

Note: `src/matcher.ts` is split from `src/server.ts` to keep the matching logic independently testable. The server delegates to the matcher.

---

## Chunk 1: Project Scaffolding & Types

### Task 1: Initialize project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "systems-thinking-mcp",
  "version": "0.1.0",
  "description": "MCP server providing systems thinking models as composable analysis lenses",
  "type": "module",
  "bin": {
    "systems-thinking-mcp": "dist/index.js"
  },
  "files": [
    "dist",
    "models"
  ],
  "scripts": {
    "build": "tsc && shx chmod +x dist/*.js",
    "prepare": "npm run build",
    "watch": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.24.0",
    "chalk": "^5.3.0",
    "js-yaml": "^4.1.0",
    "yargs": "^17.7.2",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.0.0",
    "@types/yargs": "^17.0.32",
    "shx": "^0.3.4",
    "typescript": "^5.3.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated, zero errors

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.superpowers/
```

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore package-lock.json
git commit -m "chore: initialize project with dependencies"
```

---

### Task 2: Define types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write the types file**

This defines all shared interfaces used across the server. Key types:

```typescript
import { z } from "zod";

// --- Model Definition (loaded from YAML) ---

export interface RequiredFieldDef {
  description: string;
  hint: string;
}

export interface RelatedModel {
  id: string;
  reason: string;
}

export interface ModelDefinition {
  id: string;
  name: string;
  category: string; // Set by directory, not YAML
  tags: string[];
  description: string;
  guiding_questions: string[];
  required_fields: Record<string, RequiredFieldDef>;
  related_models: RelatedModel[];
}

// --- Session State ---

export interface LensApplication {
  modelId: string;
  analysis: string;
  findings: Record<string, string>;
  observations?: string;
  confidence?: "low" | "medium" | "high";
  appliedAt: number;
}

export interface Session {
  id: string;
  problem: string;
  context?: string;
  scope?: string;
  lenses: LensApplication[];
  startedAt: number;
}

// --- Tool I/O ---

export interface LensSuggestion {
  modelId: string;
  name: string;
  reason: string;
  guidingQuestions: string[];
  requiredFields: Record<string, RequiredFieldDef>;
}

export interface CrossReference {
  fromLens: string;
  findingKey: string;
  findingExcerpt: string;
  relevance: string;
}

// --- Zod Schemas for tool inputs ---

export const StartAnalysisInput = z.object({
  problem: z.string().describe("What are we analyzing or troubleshooting?"),
  context: z.string().optional().describe("System description, constraints, environment"),
  scope: z.string().optional().describe("What is in or out of bounds for this analysis"),
});

export const ApplyLensInput = z.object({
  sessionId: z.string().describe("Session ID from start_analysis"),
  modelId: z.string().describe("Model to apply (e.g. 'queuing-theory', 'bottom-up')"),
  analysis: z.string().describe("Your analysis through this lens"),
  findings: z.record(z.string(), z.string()).describe("Model-specific findings keyed by required field names"),
  observations: z.string().optional().describe("Emergent insights outside the model template"),
  confidence: z.enum(["low", "medium", "high"]).optional().describe("Confidence in this analysis"),
  nextLens: z.string().optional().describe("Which lens you want to apply next"),
});

export const SynthesizeInput = z.object({
  sessionId: z.string().describe("Session ID from start_analysis"),
  synthesis: z.string().describe("Cross-lens integration of findings"),
  recommendations: z.array(z.string()).describe("Actionable outcomes from the analysis"),
  contradictions: z.string().optional().describe("Where lenses disagreed"),
  gaps: z.string().optional().describe("What was not examined"),
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared types and Zod schemas"
```

---

## Chunk 2: Model Loader

### Task 3: Write loader tests

**Files:**
- Create: `tests/loader.test.ts`
- Create: `tests/fixtures/test-models/operations/test-model.yaml` (test fixture)

- [ ] **Step 1: Create test fixture**

Create `tests/fixtures/test-models/operations/test-model.yaml`:

```yaml
id: test-model
name: Test Model
tags: [testing, fixture]
description: A test model for unit tests.

guiding_questions:
  - Is this a test?
  - Does it work?

required_fields:
  test_field:
    description: A test field
    hint: "Put test data here"

related_models:
  - id: other-model
    reason: "For testing relationships"
```

- [ ] **Step 2: Write loader tests**

Create `tests/loader.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { loadModelsFromDirectory } from "../src/loader.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures", "test-models");

describe("loadModelsFromDirectory", () => {
  it("loads YAML files from category subdirectories", async () => {
    const models = await loadModelsFromDirectory(fixturesDir);
    expect(models.length).toBeGreaterThanOrEqual(1);
    const testModel = models.find((m) => m.id === "test-model");
    expect(testModel).toBeDefined();
  });

  it("sets category from directory name, not YAML field", async () => {
    const models = await loadModelsFromDirectory(fixturesDir);
    const testModel = models.find((m) => m.id === "test-model")!;
    expect(testModel.category).toBe("operations");
  });

  it("parses all model fields correctly", async () => {
    const models = await loadModelsFromDirectory(fixturesDir);
    const testModel = models.find((m) => m.id === "test-model")!;
    expect(testModel.name).toBe("Test Model");
    expect(testModel.tags).toEqual(["testing", "fixture"]);
    expect(testModel.description).toContain("test model");
    expect(testModel.guiding_questions).toHaveLength(2);
    expect(testModel.required_fields.test_field.description).toBe("A test field");
    expect(testModel.required_fields.test_field.hint).toBe("Put test data here");
    expect(testModel.related_models[0].id).toBe("other-model");
  });

  it("returns empty array for nonexistent directory", async () => {
    const models = await loadModelsFromDirectory("/nonexistent/path");
    expect(models).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/loader.test.ts`
Expected: FAIL — `loadModelsFromDirectory` does not exist

- [ ] **Step 4: Commit**

```bash
git add tests/loader.test.ts tests/fixtures/
git commit -m "test: add loader tests and fixture"
```

---

### Task 4: Implement the loader

**Files:**
- Create: `src/loader.ts`

- [ ] **Step 1: Write the loader**

```typescript
import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import type { ModelDefinition } from "./types.js";

export async function loadModelsFromDirectory(
  dir: string
): Promise<ModelDefinition[]> {
  const models: ModelDefinition[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  for (const categoryDir of entries) {
    const categoryPath = path.join(dir, categoryDir);
    const stat = await fs.stat(categoryPath);
    if (!stat.isDirectory()) continue;

    const files = await fs.readdir(categoryPath);
    for (const file of files) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
      const filePath = path.join(categoryPath, file);
      const content = await fs.readFile(filePath, "utf-8");
      const parsed = yaml.load(content) as Record<string, unknown>;

      const model: ModelDefinition = {
        id: parsed.id as string,
        name: parsed.name as string,
        category: categoryDir, // Directory is authoritative
        tags: (parsed.tags as string[]) || [],
        description: (parsed.description as string) || "",
        guiding_questions: (parsed.guiding_questions as string[]) || [],
        required_fields: (parsed.required_fields as ModelDefinition["required_fields"]) || {},
        related_models: (parsed.related_models as ModelDefinition["related_models"]) || [],
      };

      models.push(model);
    }
  }

  return models;
}

export async function loadModels(
  builtinDir: string,
  customDir?: string
): Promise<ModelDefinition[]> {
  const builtins = await loadModelsFromDirectory(builtinDir);

  if (!customDir) return builtins;

  const customs = await loadModelsFromDirectory(customDir);
  const customIds = new Set(customs.map((m) => m.id));

  // Custom models overlay builtins — same id = custom wins
  const filtered = builtins.filter((m) => !customIds.has(m.id));
  return [...filtered, ...customs];
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/loader.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/loader.ts
git commit -m "feat: implement YAML model loader with directory scanning"
```

---

### Task 5: Add overlay tests and verify

**Files:**
- Modify: `tests/loader.test.ts`
- Create: `tests/fixtures/custom-models/operations/test-model.yaml` (override fixture)

- [ ] **Step 1: Create custom model fixture that overrides the built-in**

Create `tests/fixtures/custom-models/operations/test-model.yaml`:

```yaml
id: test-model
name: Custom Test Model
tags: [custom, override]
description: A custom override of the test model.

guiding_questions:
  - Is this the custom version?

required_fields:
  custom_field:
    description: A custom field
    hint: "Custom hint"

related_models: []
```

- [ ] **Step 2: Add overlay tests**

Append to `tests/loader.test.ts`:

```typescript
import { loadModels } from "../src/loader.js";

const customDir = path.join(__dirname, "fixtures", "custom-models");

describe("loadModels (overlay)", () => {
  it("returns only builtins when no custom dir", async () => {
    const models = await loadModels(fixturesDir);
    expect(models.find((m) => m.id === "test-model")).toBeDefined();
  });

  it("custom model overrides builtin with same id", async () => {
    const models = await loadModels(fixturesDir, customDir);
    const testModel = models.find((m) => m.id === "test-model")!;
    expect(testModel.name).toBe("Custom Test Model");
    expect(testModel.tags).toEqual(["custom", "override"]);
  });
});
```

- [ ] **Step 3: Run all loader tests**

Run: `npx vitest run tests/loader.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 4: Commit**

```bash
git add tests/loader.test.ts tests/fixtures/custom-models/
git commit -m "test: add overlay tests for custom model loading"
```

---

## Chunk 3: Keyword Matcher

### Task 6: Write matcher tests

**Files:**
- Create: `tests/matcher.test.ts`

- [ ] **Step 1: Write matcher tests**

```typescript
import { describe, it, expect } from "vitest";
import { suggestLenses, findCrossReferences } from "../src/matcher.js";
import type { ModelDefinition, LensApplication } from "../src/types.js";

const mockModels: ModelDefinition[] = [
  {
    id: "queuing-theory",
    name: "Queuing Theory",
    category: "operations",
    tags: ["throughput", "latency", "waiting", "load"],
    description: "Analyze arrival rates, service rates, wait times, and queue stability",
    guiding_questions: ["Where do requests queue up?"],
    required_fields: {
      arrival_rate: { description: "Request arrival rate", hint: "Requests per second" },
    },
    related_models: [{ id: "buffers", reason: "Buffers absorb queue overflow" }],
  },
  {
    id: "bottom-up",
    name: "Bottom-Up",
    category: "troubleshooting",
    tags: ["infrastructure", "dependencies", "assumptions", "diagnostic"],
    description: "Start from foundations, challenge assumptions about infrastructure",
    guiding_questions: ["Is the infrastructure healthy?"],
    required_fields: {
      assumptions_challenged: { description: "Assumptions tested", hint: "What did you verify?" },
    },
    related_models: [],
  },
  {
    id: "caches",
    name: "Caches",
    category: "troubleshooting",
    tags: ["staleness", "invalidation", "ttl", "layers", "diagnostic"],
    description: "Audit all caching layers for invalidation and staleness issues",
    guiding_questions: ["What caches are in play?"],
    required_fields: {
      cache_layers: { description: "Identified cache layers", hint: "List all caches" },
    },
    related_models: [],
  },
];

describe("suggestLenses", () => {
  it("matches problem text against model tags", () => {
    const suggestions = suggestLenses("high latency and slow throughput", mockModels, []);
    expect(suggestions[0].modelId).toBe("queuing-theory");
  });

  it("matches against description text", () => {
    const suggestions = suggestLenses("caching layers seem stale", mockModels, []);
    const ids = suggestions.map((s) => s.modelId);
    expect(ids).toContain("caches");
  });

  it("excludes already-applied lenses", () => {
    const suggestions = suggestLenses("high latency", mockModels, ["queuing-theory"]);
    const ids = suggestions.map((s) => s.modelId);
    expect(ids).not.toContain("queuing-theory");
  });

  it("returns at most maxResults suggestions", () => {
    const suggestions = suggestLenses("infrastructure diagnostic latency caching", mockModels, [], 2);
    expect(suggestions.length).toBeLessThanOrEqual(2);
  });

  it("includes guidingQuestions and requiredFields in suggestions", () => {
    const suggestions = suggestLenses("latency", mockModels, []);
    const qt = suggestions.find((s) => s.modelId === "queuing-theory");
    expect(qt?.guidingQuestions).toEqual(["Where do requests queue up?"]);
    expect(qt?.requiredFields.arrival_rate).toBeDefined();
  });
});

describe("findCrossReferences", () => {
  const priorLenses: LensApplication[] = [
    {
      modelId: "bottom-up",
      analysis: "Checked infrastructure",
      findings: {
        assumptions_challenged: "Redis memory at 95% capacity, possible eviction pressure",
      },
      appliedAt: Date.now(),
    },
  ];

  it("finds keyword matches between prior findings and current model", () => {
    const cacheModel = mockModels.find((m) => m.id === "caches")!;
    const refs = findCrossReferences(priorLenses, cacheModel);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0].fromLens).toBe("bottom-up");
    expect(refs[0].findingKey).toBe("assumptions_challenged");
  });

  it("returns empty array when no prior lenses", () => {
    const cacheModel = mockModels.find((m) => m.id === "caches")!;
    const refs = findCrossReferences([], cacheModel);
    expect(refs).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/matcher.test.ts`
Expected: FAIL — `suggestLenses` and `findCrossReferences` do not exist

- [ ] **Step 3: Commit**

```bash
git add tests/matcher.test.ts
git commit -m "test: add matcher tests for suggestions and cross-references"
```

---

### Task 7: Implement the matcher

**Files:**
- Create: `src/matcher.ts`

- [ ] **Step 1: Write the matcher**

```typescript
import type {
  ModelDefinition,
  LensApplication,
  LensSuggestion,
  CrossReference,
} from "./types.js";

/**
 * Tokenize text into lowercase words for matching.
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1)
  );
}

/**
 * Score a model against problem text. Higher = more relevant.
 * Matches against tags and description words.
 */
function scoreModel(problemTokens: Set<string>, model: ModelDefinition): number {
  let score = 0;
  for (const tag of model.tags) {
    const tagTokens = tokenize(tag);
    for (const t of tagTokens) {
      if (problemTokens.has(t)) score += 2; // Tags weighted higher
    }
  }
  const descTokens = tokenize(model.description);
  for (const t of descTokens) {
    if (problemTokens.has(t)) score += 1;
  }
  return score;
}

/**
 * Suggest lenses based on problem text, excluding already-applied ones.
 */
export function suggestLenses(
  problemText: string,
  models: ModelDefinition[],
  appliedModelIds: string[],
  maxResults: number = 5
): LensSuggestion[] {
  const applied = new Set(appliedModelIds);
  const tokens = tokenize(problemText);

  const scored = models
    .filter((m) => !applied.has(m.id))
    .map((m) => ({ model: m, score: scoreModel(tokens, m) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return scored.map((s) => ({
    modelId: s.model.id,
    name: s.model.name,
    reason: `Matched on problem keywords (score: ${s.score}) — ${s.model.description.slice(0, 100)}`,
    guidingQuestions: s.model.guiding_questions,
    requiredFields: s.model.required_fields,
  }));
}

/**
 * Find cross-references between prior lens findings and the current model.
 * Scans prior findings values for words that appear in the current model's
 * required_fields descriptions and guiding_questions.
 */
export function findCrossReferences(
  priorLenses: LensApplication[],
  currentModel: ModelDefinition
): CrossReference[] {
  if (priorLenses.length === 0) return [];

  // Build token set from current model's field descriptions and guiding questions
  const modelText = [
    ...currentModel.guiding_questions,
    ...Object.values(currentModel.required_fields).map((f) => f.description),
    ...Object.values(currentModel.required_fields).map((f) => f.hint),
  ].join(" ");
  const modelTokens = tokenize(modelText);

  const refs: CrossReference[] = [];

  for (const lens of priorLenses) {
    for (const [key, value] of Object.entries(lens.findings)) {
      const findingTokens = tokenize(value);
      const overlap: string[] = [];
      for (const t of findingTokens) {
        if (modelTokens.has(t)) overlap.push(t);
      }
      if (overlap.length > 0) {
        refs.push({
          fromLens: lens.modelId,
          findingKey: key,
          findingExcerpt: value.length > 200 ? value.slice(0, 200) + "..." : value,
          relevance: `Shared terms: ${overlap.slice(0, 5).join(", ")}`,
        });
      }
    }
  }

  return refs;
}

/**
 * Get related model suggestions from the current model's related_models list,
 * enriched with full model data, excluding already-applied lenses.
 */
export function getRelatedSuggestions(
  currentModel: ModelDefinition,
  allModels: ModelDefinition[],
  appliedModelIds: string[]
): LensSuggestion[] {
  const applied = new Set(appliedModelIds);
  const modelMap = new Map(allModels.map((m) => [m.id, m]));

  return currentModel.related_models
    .filter((r) => !applied.has(r.id) && modelMap.has(r.id))
    .map((r) => {
      const model = modelMap.get(r.id)!;
      return {
        modelId: model.id,
        name: model.name,
        reason: r.reason,
        guidingQuestions: model.guiding_questions,
        requiredFields: model.required_fields,
      };
    });
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/matcher.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/matcher.ts
git commit -m "feat: implement keyword matcher for suggestions and cross-refs"
```

---

## Chunk 4: Server Core

### Task 8: Write server tests

**Files:**
- Create: `tests/server.test.ts`

- [ ] **Step 1: Write server tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { SystemsThinkingServer } from "../src/server.js";
import type { ModelDefinition } from "../src/types.js";

const testModels: ModelDefinition[] = [
  {
    id: "constraints",
    name: "Constraint Analysis",
    category: "operations",
    tags: ["bottleneck", "throughput", "capacity", "planning"],
    description: "Find the binding constraint limiting system throughput",
    guiding_questions: [
      "Where does work pile up?",
      "Which component limits the whole system?",
    ],
    required_fields: {
      binding_constraint: {
        description: "The single constraint limiting the system",
        hint: "Which one dominates?",
      },
      exploitation: {
        description: "How to maximize throughput at the constraint",
        hint: "Are we fully using what we have?",
      },
    },
    related_models: [
      { id: "queuing-theory", reason: "Quantify wait times at constraint" },
    ],
  },
  {
    id: "queuing-theory",
    name: "Queuing Theory",
    category: "operations",
    tags: ["throughput", "latency", "waiting", "load"],
    description: "Analyze arrival rates, service rates, and wait times",
    guiding_questions: ["Where do requests queue?"],
    required_fields: {
      arrival_rate: {
        description: "Request arrival rate",
        hint: "Requests per second",
      },
    },
    related_models: [],
  },
];

describe("SystemsThinkingServer", () => {
  let server: SystemsThinkingServer;

  beforeEach(() => {
    server = new SystemsThinkingServer(testModels);
  });

  describe("startAnalysis", () => {
    it("creates a session and returns sessionId", () => {
      const result = server.startAnalysis({
        problem: "System is slow under load",
      });
      expect(result.sessionId).toBeDefined();
      expect(result.problem).toBe("System is slow under load");
    });

    it("suggests lenses based on problem text", () => {
      const result = server.startAnalysis({
        problem: "throughput bottleneck causing high latency",
      });
      expect(result.suggestedLenses.length).toBeGreaterThan(0);
    });

    it("creates independent sessions on duplicate calls", () => {
      const r1 = server.startAnalysis({ problem: "Problem A" });
      const r2 = server.startAnalysis({ problem: "Problem B" });
      expect(r1.sessionId).not.toBe(r2.sessionId);
      // Applying lens to one session does not affect the other
      server.applyLens({
        sessionId: r1.sessionId,
        modelId: "constraints",
        analysis: "test",
        findings: { binding_constraint: "X", exploitation: "Y" },
      });
      const synth = server.synthesize({
        sessionId: r2.sessionId,
        synthesis: "empty",
        recommendations: [],
      });
      expect(synth.lensesApplied).toHaveLength(0);
    });
  });

  describe("applyLens", () => {
    it("applies a valid lens to an existing session", () => {
      const { sessionId } = server.startAnalysis({
        problem: "System bottleneck",
      });
      const result = server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "The database is the bottleneck",
        findings: {
          binding_constraint: "Database write throughput",
          exploitation: "Add connection pooling",
        },
      });
      expect(result.modelId).toBe("constraints");
      expect(result.missingFields).toEqual([]);
    });

    it("returns missingFields for incomplete findings", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "Partial analysis",
        findings: { binding_constraint: "DB writes" },
      });
      expect(result.missingFields).toContain("exploitation");
    });

    it("returns error with available sessions for invalid sessionId", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.applyLens({
        sessionId: "nonexistent",
        modelId: "constraints",
        analysis: "test",
        findings: {},
      });
      expect(result.error).toContain("Session not found");
      expect(result.availableSessions).toContain(sessionId);
    });

    it("returns error for unknown modelId", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.applyLens({
        sessionId,
        modelId: "nonexistent",
        analysis: "test",
        findings: {},
      });
      expect(result.error).toBeDefined();
      expect(result.availableModels).toBeDefined();
    });

    it("returns suggestedNextLenses from related_models", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "Found bottleneck",
        findings: {
          binding_constraint: "DB",
          exploitation: "Pooling",
        },
      });
      const ids = result.suggestedNextLenses!.map((s) => s.modelId);
      expect(ids).toContain("queuing-theory");
    });

    it("excludes already-applied lenses from suggestedNextLenses", () => {
      const { sessionId } = server.startAnalysis({ problem: "throughput bottleneck" });
      server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "Found bottleneck",
        findings: { binding_constraint: "DB", exploitation: "Pooling" },
      });
      const result = server.applyLens({
        sessionId,
        modelId: "queuing-theory",
        analysis: "Analyzing queues",
        findings: { arrival_rate: "500/s" },
      });
      const ids = result.suggestedNextLenses!.map((s) => s.modelId);
      expect(ids).not.toContain("constraints");
      expect(ids).not.toContain("queuing-theory");
    });

    it("returns crossReferences from prior lenses", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "Found bottleneck",
        findings: {
          binding_constraint: "Request arrival rate exceeds capacity",
          exploitation: "Limit concurrent requests",
        },
      });
      const result = server.applyLens({
        sessionId,
        modelId: "queuing-theory",
        analysis: "Analyzing queues",
        findings: { arrival_rate: "500 req/s" },
      });
      // Cross-ref should find "arrival rate" overlap
      expect(result.crossReferences).toBeDefined();
    });
  });

  describe("synthesize", () => {
    it("returns full session with synthesis", () => {
      const { sessionId } = server.startAnalysis({ problem: "Slow system" });
      server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "DB bottleneck",
        findings: {
          binding_constraint: "DB writes",
          exploitation: "Connection pooling",
        },
      });
      const result = server.synthesize({
        sessionId,
        synthesis: "The DB is the core issue",
        recommendations: ["Add read replicas", "Implement caching"],
      });
      expect(result.problem).toBe("Slow system");
      expect(result.lensesApplied).toHaveLength(1);
      expect(result.recommendations).toHaveLength(2);
    });

    it("warns when synthesizing with zero lenses", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.synthesize({
        sessionId,
        synthesis: "No lenses applied",
        recommendations: [],
      });
      expect(result.warning).toBeDefined();
    });

    it("returns error with available sessions for invalid sessionId", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.synthesize({
        sessionId: "nonexistent",
        synthesis: "test",
        recommendations: [],
      });
      expect(result.error).toContain("Session not found");
      expect(result.availableSessions).toContain(sessionId);
    });

    it("allows apply_lens after synthesize", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      server.synthesize({
        sessionId,
        synthesis: "Initial synthesis",
        recommendations: [],
      });
      const result = server.applyLens({
        sessionId,
        modelId: "queuing-theory",
        analysis: "Additional analysis",
        findings: { arrival_rate: "100/s" },
      });
      expect(result.modelId).toBe("queuing-theory");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server.test.ts`
Expected: FAIL — `SystemsThinkingServer` does not exist

- [ ] **Step 3: Commit**

```bash
git add tests/server.test.ts
git commit -m "test: add server tests for session lifecycle and error handling"
```

---

### Task 9: Implement the server

**Files:**
- Create: `src/server.ts`

- [ ] **Step 1: Write the server**

```typescript
import { randomUUID } from "crypto";
import type {
  ModelDefinition,
  Session,
  LensApplication,
  LensSuggestion,
  CrossReference,
} from "./types.js";
import { suggestLenses, findCrossReferences, getRelatedSuggestions } from "./matcher.js";

export class SystemsThinkingServer {
  private models: ModelDefinition[];
  private modelMap: Map<string, ModelDefinition>;
  private sessions: Map<string, Session> = new Map();

  constructor(models: ModelDefinition[]) {
    this.models = models;
    this.modelMap = new Map(models.map((m) => [m.id, m]));
  }

  startAnalysis(input: {
    problem: string;
    context?: string;
    scope?: string;
  }): {
    sessionId: string;
    problem: string;
    suggestedLenses: LensSuggestion[];
  } {
    const sessionId = randomUUID().slice(0, 12);
    const session: Session = {
      id: sessionId,
      problem: input.problem,
      context: input.context,
      scope: input.scope,
      lenses: [],
      startedAt: Date.now(),
    };
    this.sessions.set(sessionId, session);

    const searchText = [input.problem, input.context, input.scope]
      .filter(Boolean)
      .join(" ");

    return {
      sessionId,
      problem: input.problem,
      suggestedLenses: suggestLenses(searchText, this.models, []),
    };
  }

  applyLens(input: {
    sessionId: string;
    modelId: string;
    analysis: string;
    findings: Record<string, string>;
    observations?: string;
    confidence?: "low" | "medium" | "high";
    nextLens?: string;
  }): {
    modelId?: string;
    guidingQuestions?: string[];
    requiredFields?: ModelDefinition["required_fields"];
    missingFields?: string[];
    crossReferences?: CrossReference[];
    suggestedNextLenses?: LensSuggestion[];
    sessionSummary?: { problem: string; lensesApplied: string[] };
    error?: string;
    availableSessions?: string[];
    availableModels?: string[];
  } {
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      const sessionKeys = [...this.sessions.keys()];
      return {
        error: `Session not found: ${input.sessionId}`,
        availableSessions: sessionKeys.length > 0 ? sessionKeys : undefined,
      };
    }

    const model = this.modelMap.get(input.modelId);
    if (!model) {
      return {
        error: `Unknown model: ${input.modelId}`,
        availableModels: [...this.modelMap.keys()],
      };
    }

    // Check for missing required fields
    const requiredKeys = Object.keys(model.required_fields);
    const providedKeys = Object.keys(input.findings);
    const missingFields = requiredKeys.filter((k) => !providedKeys.includes(k));

    // Store the lens application
    const lensApp: LensApplication = {
      modelId: input.modelId,
      analysis: input.analysis,
      findings: input.findings,
      observations: input.observations,
      confidence: input.confidence,
      appliedAt: Date.now(),
    };
    session.lenses.push(lensApp);

    // Cross-references from prior lenses (excluding the one just applied)
    const priorLenses = session.lenses.slice(0, -1);
    const crossReferences = findCrossReferences(priorLenses, model);

    // Suggested next lenses: related_models + tag matching
    const appliedIds = session.lenses.map((l) => l.modelId);
    const relatedSuggestions = getRelatedSuggestions(model, this.models, appliedIds);

    const searchText = [session.problem, session.context, session.scope]
      .filter(Boolean)
      .join(" ");
    const tagSuggestions = suggestLenses(searchText, this.models, appliedIds, 3);

    // Merge: related first, then tag-based, deduplicate
    const seen = new Set<string>();
    const suggestedNextLenses: LensSuggestion[] = [];
    for (const s of [...relatedSuggestions, ...tagSuggestions]) {
      if (!seen.has(s.modelId)) {
        seen.add(s.modelId);
        suggestedNextLenses.push(s);
      }
    }

    return {
      modelId: input.modelId,
      guidingQuestions: model.guiding_questions,
      requiredFields: model.required_fields,
      missingFields,
      crossReferences,
      suggestedNextLenses: suggestedNextLenses.slice(0, 3),
      sessionSummary: {
        problem: session.problem,
        lensesApplied: session.lenses.map((l) => l.modelId),
      },
    };
  }

  synthesize(input: {
    sessionId: string;
    synthesis: string;
    recommendations: string[];
    contradictions?: string;
    gaps?: string;
  }): {
    sessionId?: string;
    problem?: string;
    lensesApplied?: Array<{
      modelId: string;
      analysis: string;
      findings: Record<string, string>;
      observations?: string;
      confidence?: string;
    }>;
    synthesis?: string;
    recommendations?: string[];
    contradictions?: string;
    gaps?: string;
    suggestedAdditionalLenses?: LensSuggestion[];
    warning?: string;
    error?: string;
    availableSessions?: string[];
  } {
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      const sessionKeys = [...this.sessions.keys()];
      return {
        error: `Session not found: ${input.sessionId}`,
        availableSessions: sessionKeys.length > 0 ? sessionKeys : undefined,
      };
    }

    const warning =
      session.lenses.length === 0
        ? "No lenses applied yet — synthesis will be based on the problem statement alone."
        : undefined;

    // Suggest lenses that might fill gaps
    const appliedIds = session.lenses.map((l) => l.modelId);
    const searchText = [session.problem, session.context, input.gaps]
      .filter(Boolean)
      .join(" ");
    const suggestedAdditionalLenses = suggestLenses(
      searchText,
      this.models,
      appliedIds,
      3
    );

    return {
      sessionId: session.id,
      problem: session.problem,
      lensesApplied: session.lenses.map((l) => ({
        modelId: l.modelId,
        analysis: l.analysis,
        findings: l.findings,
        observations: l.observations,
        confidence: l.confidence,
      })),
      synthesis: input.synthesis,
      recommendations: input.recommendations,
      contradictions: input.contradictions,
      gaps: input.gaps,
      suggestedAdditionalLenses,
      warning,
    };
  }
}
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS (loader, matcher, and server)

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: implement SystemsThinkingServer with session state and cross-lens intelligence"
```

---

## Chunk 5: MCP Entry Point

### Task 10: Implement the MCP server entry point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write the MCP server entry**

```typescript
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
  description: `Apply a systems thinking model to the current problem. Each model provides guiding questions and expects specific findings.

Available models: ${models.map((m) => `${m.id} (${m.name})`).join(", ")}

The tool returns:
- guidingQuestions and requiredFields for the model (reference)
- missingFields if any required findings were not provided (soft reminder)
- crossReferences to prior lens findings that may be relevant
- suggestedNextLenses with full guiding questions and required fields

Can be called multiple times per session to build composable analysis. Allowed after synthesize (session stays open).`,
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `dist/` directory created with compiled JS files

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: implement MCP server entry point with tool registration"
```

---

## Chunk 6: Model Definitions

### Task 11: Write architecture model definitions

**Files:**
- Create: `models/architecture/modularity.yaml`
- Create: `models/architecture/coupling-cohesion.yaml`
- Create: `models/architecture/conways-law.yaml`
- Create: `models/architecture/failure-modes.yaml`

- [ ] **Step 1: Write all 4 architecture models**

`models/architecture/modularity.yaml`:
```yaml
id: modularity
name: Modularity
category: architecture
tags: [boundaries, decomposition, interfaces, planning]
description: >
  Evaluate how well a system decomposes into independent, interchangeable units.
  Good modularity means units can be understood, developed, tested, and replaced
  independently.

guiding_questions:
  - What are the major units/modules in this system?
  - Can each unit be understood without reading the internals of others?
  - Can you change one unit's internals without breaking consumers?
  - Are the interfaces between units well-defined and minimal?
  - Which modules are too large or doing too many things?
  - Are there hidden dependencies between modules that bypass the interfaces?

required_fields:
  modules_identified:
    description: List of major modules/units in the system
    hint: "Name each module and state its single responsibility"
  interface_quality:
    description: Assessment of interfaces between modules
    hint: "Are they minimal, well-defined, and stable?"
  independence_assessment:
    description: How independently can each module be changed, tested, and deployed?
    hint: "Which modules are tangled? Which are truly independent?"
  improvement_opportunities:
    description: Where modularity could be improved
    hint: "Which boundaries should be drawn differently?"

related_models:
  - id: coupling-cohesion
    reason: "Coupling/cohesion provides quantitative measures for module quality"
  - id: failure-modes
    reason: "Module boundaries affect failure isolation"
  - id: conways-law
    reason: "Team structure often dictates module boundaries"
```

`models/architecture/coupling-cohesion.yaml`:
```yaml
id: coupling-cohesion
name: Coupling & Cohesion
category: architecture
tags: [dependencies, isolation, refactoring, planning]
description: >
  Measure interdependence between modules (coupling) and focus within them
  (cohesion). Low coupling + high cohesion = maintainable systems.

guiding_questions:
  - Which modules depend on each other? How tightly?
  - If you change module A, which other modules break?
  - Does each module do one thing well, or is it a grab bag?
  - Are there circular dependencies?
  - Which coupling is through stable interfaces vs. shared internals?
  - What type of coupling exists — data, stamp, control, content?

required_fields:
  coupling_map:
    description: Key dependencies between modules and their type/strength
    hint: "Identify the tightest couplings — these are the riskiest"
  cohesion_assessment:
    description: For each module, how focused is its responsibility?
    hint: "High cohesion = everything in the module relates to one purpose"
  problematic_dependencies:
    description: Dependencies that cause the most pain or risk
    hint: "Circular deps, shared mutable state, content coupling"
  decoupling_strategies:
    description: How to reduce coupling where it matters
    hint: "Interfaces, events, dependency inversion — what fits here?"

related_models:
  - id: modularity
    reason: "Modularity provides the structural context for coupling analysis"
  - id: leverage-points
    reason: "Decoupling a key dependency can be a high-leverage intervention"
```

`models/architecture/conways-law.yaml`:
```yaml
id: conways-law
name: Conway's Law
category: architecture
tags: [organization, communication, team-structure, planning]
description: >
  Organizations design systems that mirror their communication structures.
  Examine how team boundaries, reporting lines, and communication patterns
  shape (and constrain) the system architecture.

guiding_questions:
  - Which teams own which components?
  - Where do team boundaries align with system boundaries? Where do they diverge?
  - Which cross-team interfaces are the most painful?
  - Are there components that require coordination across many teams to change?
  - Would restructuring teams improve the architecture (or vice versa)?
  - Are there communication bottlenecks that create architectural bottlenecks?

required_fields:
  team_component_map:
    description: Mapping of teams to the components they own
    hint: "Where multiple teams touch the same component, friction lives"
  alignment_assessment:
    description: Where do org boundaries match system boundaries? Where not?
    hint: "Misalignment predicts integration pain"
  communication_bottlenecks:
    description: Cross-team coordination points that slow things down
    hint: "Shared services, APIs requiring cross-team changes"
  structural_recommendations:
    description: Team or architecture changes that would improve alignment
    hint: "Sometimes moving code is easier than moving people, and vice versa"

related_models:
  - id: modularity
    reason: "Module boundaries should ideally align with team boundaries"
  - id: constraints
    reason: "Organizational constraints often bind tighter than technical ones"
```

`models/architecture/failure-modes.yaml`:
```yaml
id: failure-modes
name: Failure Modes
category: architecture
tags: [resilience, cascading, fault-tolerance, risk]
description: >
  Systematically identify how components can fail and what cascades follow.
  Every component fails eventually — the question is whether failures are
  isolated or catastrophic.

guiding_questions:
  - What are the single points of failure in this system?
  - When component X fails, what happens to components that depend on it?
  - Are failures detected quickly? How?
  - What is the blast radius of each failure mode?
  - Are there graceful degradation paths, or is it all-or-nothing?
  - What failure modes are we not testing for?

required_fields:
  failure_catalog:
    description: List of failure modes with trigger, impact, and likelihood
    hint: "Include infrastructure, software, data, and human failures"
  cascade_paths:
    description: How failures propagate through the system
    hint: "A fails → B times out → C queues overflow → user sees error"
  detection_gaps:
    description: Failures that would go undetected or be detected too late
    hint: "Silent corruption is worse than noisy failure"
  mitigation_strategies:
    description: How to prevent, detect, or recover from each failure mode
    hint: "Redundancy, circuit breakers, timeouts, fallbacks"

related_models:
  - id: modularity
    reason: "Module boundaries are failure isolation boundaries"
  - id: buffers
    reason: "Buffers absorb transient failures and prevent cascades"
  - id: feedback-loops
    reason: "Failure cascades are runaway positive feedback loops"
```

- [ ] **Step 2: Verify loader picks them up**

Run: `npx vitest run tests/loader.test.ts`
Expected: Still passes (tests use fixture dir, not built-in models)

- [ ] **Step 3: Commit**

```bash
git add models/architecture/
git commit -m "feat: add 4 architecture model definitions"
```

---

### Task 12: Write dynamics model definitions

**Files:**
- Create: `models/dynamics/source-sink.yaml`
- Create: `models/dynamics/system-dynamics.yaml`
- Create: `models/dynamics/feedback-loops.yaml`
- Create: `models/dynamics/stock-and-flow.yaml`
- Create: `models/dynamics/causal-loop-diagrams.yaml`

- [ ] **Step 1: Write all 5 dynamics models**

`models/dynamics/source-sink.yaml`:
```yaml
id: source-sink
name: Source & Sink
category: dynamics
tags: [data-flow, inputs, outputs, lifecycle]
description: >
  Trace where inputs originate (sources) and where outputs or waste terminate
  (sinks). Understanding sources and sinks reveals hidden dependencies,
  resource constraints, and cleanup responsibilities.

guiding_questions:
  - Where does data/work/resources enter this system?
  - Where does it leave? Is anything accumulating without a sink?
  - Are there sources we're not aware of or not controlling?
  - What happens when a source is unavailable or produces bad data?
  - Are sinks being overwhelmed? Are they cleaning up properly?
  - Is there a lifecycle for each resource from source to sink?

required_fields:
  sources_identified:
    description: All inputs — where data, work, or resources originate
    hint: "User input, API calls, event streams, scheduled jobs, file imports"
  sinks_identified:
    description: All outputs — where data, work, or resources terminate
    hint: "Databases, logs, external APIs, garbage collection, archives"
  accumulation_risks:
    description: Places where things accumulate without adequate drainage
    hint: "Growing queues, unbounded logs, orphaned records, memory leaks"
  lifecycle_gaps:
    description: Resources that lack a clear path from creation to cleanup
    hint: "Temporary files, sessions, cache entries without TTL"

related_models:
  - id: stock-and-flow
    reason: "Stock & flow formalizes the accumulation between sources and sinks"
  - id: buffers
    reason: "Buffers sit between sources and sinks — sizing matters"
```

`models/dynamics/system-dynamics.yaml`:
```yaml
id: system-dynamics
name: System Dynamics
category: dynamics
tags: [temporal, behavior, trends, prediction]
description: >
  Model how system behavior evolves over time. Focus on delays,
  oscillations, exponential growth or decay, and tipping points.
  Systems rarely respond linearly or instantly.

guiding_questions:
  - How does the system behave differently under low vs. high load?
  - Where are the significant delays in the system?
  - Are there behaviors that compound over time (growth, decay, debt)?
  - What oscillations or cycles exist? What drives them?
  - Are there tipping points where behavior changes qualitatively?
  - What does the system look like in 6 months if current trends continue?

required_fields:
  temporal_behaviors:
    description: Key behaviors that change over time
    hint: "Growth curves, decay patterns, cyclical behaviors, seasonal effects"
  delays:
    description: Significant delays and their effects on system behavior
    hint: "Processing delays, propagation delays, human response delays"
  nonlinearities:
    description: Points where behavior changes disproportionately
    hint: "Tipping points, saturation, exponential growth triggers"
  trend_projections:
    description: Where current trends lead if unaddressed
    hint: "Technical debt compounding, queue growth, resource exhaustion"

related_models:
  - id: feedback-loops
    reason: "Feedback loops are the primary driver of dynamic behavior"
  - id: stock-and-flow
    reason: "Stock/flow models formalize dynamic behavior over time"
  - id: causal-loop-diagrams
    reason: "CLD maps the causal structure behind dynamic behavior"
```

`models/dynamics/feedback-loops.yaml`:
```yaml
id: feedback-loops
name: Feedback & Feedforward Loops
category: dynamics
tags: [amplification, stabilization, control, regulation]
description: >
  Identify reinforcing loops (positive feedback — amplify change) and
  balancing loops (negative feedback — resist change). Also look for
  feedforward controls that anticipate rather than react.

guiding_questions:
  - What reinforcing loops exist? What do they amplify?
  - What balancing loops exist? What do they stabilize?
  - Are there runaway loops that lack a balancing counterpart?
  - Where does the system self-correct? Where does it spiral?
  - Are there feedforward mechanisms that anticipate load or failure?
  - What is the delay in each feedback loop? (Longer delay = more overshoot)

required_fields:
  reinforcing_loops:
    description: Positive feedback loops that amplify change
    hint: "Success breeds success, failure breeds failure, viral growth, technical debt accumulation"
  balancing_loops:
    description: Negative feedback loops that resist change and stabilize
    hint: "Rate limiters, autoscaling, circuit breakers, backpressure"
  feedforward_controls:
    description: Anticipatory controls that act before feedback arrives
    hint: "Predictive scaling, pre-warming, capacity planning"
  loop_delays:
    description: Delay in each feedback loop and its consequences
    hint: "Long delays cause overshoot and oscillation"

related_models:
  - id: leverage-points
    reason: "Changing the gain or delay of a feedback loop is a powerful leverage point"
  - id: system-dynamics
    reason: "Feedback loops drive the dynamic behavior of systems"
  - id: causal-loop-diagrams
    reason: "CLD is the standard notation for mapping feedback loops"
```

`models/dynamics/stock-and-flow.yaml`:
```yaml
id: stock-and-flow
name: Stock & Flow
category: dynamics
tags: [accumulation, rates, inventory, capacity]
description: >
  Map accumulations (stocks) and the rates (flows) that change them.
  Stocks are the state of the system at any moment; flows are the
  rates of change. Understanding this distinction clarifies cause and effect.

guiding_questions:
  - What are the key stocks (things that accumulate) in this system?
  - What inflows increase each stock? What outflows decrease it?
  - Are any stocks growing unbounded? What constrains them?
  - Where is the system's memory? (Stocks remember; flows forget)
  - Are we confusing stocks with flows? (e.g., revenue vs. profit)
  - What happens to behavior when a stock is depleted or overflowing?

required_fields:
  stocks:
    description: Key accumulations in the system
    hint: "Queues, caches, connection pools, account balances, backlogs, inventories"
  inflows:
    description: What increases each stock and at what rate
    hint: "Requests arriving, data ingested, users signing up"
  outflows:
    description: What decreases each stock and at what rate
    hint: "Requests processed, data expired, users churning"
  equilibrium_analysis:
    description: Where inflows and outflows balance (or don't)
    hint: "If inflow > outflow, the stock grows — is that sustainable?"

related_models:
  - id: source-sink
    reason: "Sources feed inflows; sinks receive outflows"
  - id: buffers
    reason: "Buffers are stocks deliberately placed to absorb flow variability"
  - id: queuing-theory
    reason: "Queues are stocks; arrival and service rates are flows"
```

`models/dynamics/causal-loop-diagrams.yaml`:
```yaml
id: causal-loop-diagrams
name: Causal Loop Diagrams
category: dynamics
tags: [causality, visualization, feedback, mental-models]
description: >
  Map cause-effect chains to reveal circular causality, unintended
  consequences, and mental model gaps. CLD makes hidden assumptions
  about causation explicit and testable.

guiding_questions:
  - What causes what in this system? Can you draw the arrows?
  - Are there circular causal chains (A causes B causes A)?
  - What unintended consequences have past changes produced?
  - Where do different people's mental models of causation disagree?
  - Are there delayed effects that are easy to miss?
  - What assumptions about cause and effect have we not tested?

required_fields:
  causal_chains:
    description: Key cause-effect relationships in the system
    hint: "A → B → C. Use + for same-direction, - for opposite-direction effects"
  circular_causality:
    description: Loops where effects feed back to causes
    hint: "These are the feedback loops — reinforcing (+) or balancing (-)"
  hidden_assumptions:
    description: Causal assumptions that are untested or contested
    hint: "Do we actually know that A causes B, or do we just assume it?"
  unintended_consequences:
    description: Past or potential side effects of interventions
    hint: "Fixing X made Y worse because we didn't see the connection"

related_models:
  - id: feedback-loops
    reason: "CLD reveals the feedback loops driving system behavior"
  - id: leverage-points
    reason: "The causal map shows where interventions propagate most widely"
  - id: system-dynamics
    reason: "CLD is the qualitative foundation for dynamic modeling"
```

- [ ] **Step 2: Commit**

```bash
git add models/dynamics/
git commit -m "feat: add 5 dynamics model definitions"
```

---

### Task 13: Write operations model definitions

**Files:**
- Create: `models/operations/queuing-theory.yaml`
- Create: `models/operations/buffers.yaml`
- Create: `models/operations/constraints.yaml`
- Create: `models/operations/leverage-points.yaml`

- [ ] **Step 1: Write all 4 operations models**

`models/operations/queuing-theory.yaml`:
```yaml
id: queuing-theory
name: Queuing Theory
category: operations
tags: [throughput, latency, waiting, load]
description: >
  Analyze arrival rates, service rates, wait times, and queue stability.
  When arrival rate approaches service rate, wait times grow nonlinearly.
  Most performance problems are queuing problems in disguise.

guiding_questions:
  - Where do requests/work items queue up in this system?
  - What is the arrival rate? What is the service rate?
  - How does utilization relate to latency? (Hint — nonlinear above ~70%)
  - What happens during traffic spikes? Is there backpressure?
  - Are there multiple servers/workers? How is work distributed?
  - What is the variance in service time? (High variance = worse queuing)

required_fields:
  queues_identified:
    description: Where work queues in the system
    hint: "Request queues, job queues, message queues, connection queues, lock waits"
  arrival_vs_service:
    description: Arrival rate vs. service rate at each queue
    hint: "If arrival > service even briefly, the queue grows"
  utilization_analysis:
    description: Utilization levels and their effect on latency
    hint: "At 80% utilization, a single-server queue averages 4x the service time in wait"
  stability_assessment:
    description: Is each queue stable (draining faster than filling) under normal and peak load?
    hint: "Unstable queues grow without bound — they must be addressed"

related_models:
  - id: buffers
    reason: "Buffers are sized queues — queuing theory informs buffer sizing"
  - id: constraints
    reason: "The queue that grows fastest is likely at the constraint"
  - id: stock-and-flow
    reason: "Queues are stocks; arrival/service rates are flows"
```

`models/operations/buffers.yaml`:
```yaml
id: buffers
name: Buffers & Buffer Sizing
category: operations
tags: [capacity, overflow, starvation, resilience]
description: >
  Evaluate where buffers exist, whether they are sized correctly, and the
  risks of overflow or starvation. Buffers absorb variability — too small
  and they overflow, too large and they hide problems.

guiding_questions:
  - Where are the explicit buffers? (queues, pools, caches, inventories)
  - Where are the implicit buffers? (retry queues, OS buffers, TCP windows)
  - What happens when a buffer overflows? Data loss? Backpressure? Crash?
  - What happens when a buffer starves? (Idle workers, empty cache, pool exhaustion)
  - Are buffers sized for normal load or peak load?
  - Are any buffers hiding problems by absorbing symptoms?

required_fields:
  buffers_identified:
    description: All buffers in the system — explicit and implicit
    hint: "Connection pools, message queues, OS socket buffers, caches, rate limiter token buckets"
  sizing_assessment:
    description: Is each buffer appropriately sized for its purpose?
    hint: "Too small = overflow risk. Too large = memory waste and latency hiding"
  overflow_behavior:
    description: What happens when each buffer fills up?
    hint: "Drop? Block? Spill to disk? Return error? Silently lose data?"
  starvation_risks:
    description: What happens when each buffer empties?
    hint: "Idle consumers, cache misses, cold starts"

related_models:
  - id: queuing-theory
    reason: "Queuing math informs optimal buffer sizing"
  - id: constraints
    reason: "Place the largest buffers in front of the constraint"
  - id: failure-modes
    reason: "Buffer overflow and starvation are common failure modes"
```

`models/operations/constraints.yaml`:
```yaml
id: constraints
name: Constraint Analysis
category: operations
tags: [bottleneck, throughput, capacity, planning]
description: >
  Identify the binding constraint that limits overall system throughput.
  Based on Theory of Constraints — the system can only perform as well
  as its most constrained component.

guiding_questions:
  - What is the desired output/throughput of this system?
  - Where does work pile up or wait?
  - Which component, if improved, would improve the whole system?
  - Are there constraints we are working around without realizing it?
  - Is this constraint physical, policy-based, or market-based?

required_fields:
  identified_constraints:
    description: List of constraints found, ranked by impact
    hint: "Include both obvious bottlenecks and hidden policy constraints"
  binding_constraint:
    description: The single constraint currently limiting the system
    hint: "There is usually one that dominates — which is it?"
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

`models/operations/leverage-points.yaml`:
```yaml
id: leverage-points
name: Leverage Points
category: operations
tags: [intervention, impact, efficiency, strategy]
description: >
  Find where small changes produce disproportionate system-wide effects.
  Based on Donella Meadows' hierarchy — from parameters (weak) to paradigms
  (powerful). Most interventions target low-leverage points.

guiding_questions:
  - Where have small changes had outsized effects in this system before?
  - Are we adjusting parameters (weak) or restructuring feedback loops (strong)?
  - What are the rules of the system? Can they be changed?
  - What information flows are missing or delayed?
  - Is there a self-organizing structure we could enable or redirect?
  - What goals or metrics are driving behavior? Are they the right ones?

required_fields:
  leverage_points_identified:
    description: Points where intervention would have disproportionate effect
    hint: "Ranked from low to high leverage using Meadows' hierarchy if applicable"
  current_interventions:
    description: Where effort is currently being applied
    hint: "Are we pushing on high-leverage or low-leverage points?"
  highest_leverage:
    description: The single most impactful intervention available
    hint: "The one change that would matter most — even if it is hard"
  intervention_risks:
    description: Risks of intervening at each leverage point
    hint: "High-leverage points are powerful but can backfire spectacularly"

related_models:
  - id: constraints
    reason: "The binding constraint is often a leverage point"
  - id: feedback-loops
    reason: "Changing feedback loop structure is high-leverage"
  - id: causal-loop-diagrams
    reason: "The causal map reveals where leverage points exist"
```

- [ ] **Step 2: Commit**

```bash
git add models/operations/
git commit -m "feat: add 4 operations model definitions"
```

---

### Task 14: Write troubleshooting model definitions

**Files:**
- Create: `models/troubleshooting/bottom-up.yaml`
- Create: `models/troubleshooting/top-down.yaml`
- Create: `models/troubleshooting/binary-search.yaml`
- Create: `models/troubleshooting/parallelism.yaml`
- Create: `models/troubleshooting/caches.yaml`

- [ ] **Step 1: Write all 5 troubleshooting models**

`models/troubleshooting/bottom-up.yaml`:
```yaml
id: bottom-up
name: Bottom-Up
category: troubleshooting
tags: [infrastructure, dependencies, assumptions, diagnostic]
description: >
  Start from the foundations and work up. Challenge assumptions about the
  health of infrastructure, dependencies, and underlying resources. The
  problem may not be where you think it is — verify from the bottom.

guiding_questions:
  - Are the basics healthy? CPU, memory, disk, network?
  - Is the system swapping, OOM-killing, or running out of file descriptors?
  - Are the volumes/disks okay? Is I/O saturated?
  - Is the network healthy? Packet loss, DNS resolution, MTU issues?
  - What supports the component under investigation? Are those dependencies actually working?
  - Did something change in the database? Schema, data volume, indexes?
  - Are our code/library dependencies sane? Have they changed recently?
  - What assumptions are we making about the environment that we have not verified?

required_fields:
  assumptions_challenged:
    description: Assumptions about infrastructure or dependencies that were tested
    hint: "I assumed the DB was fine — actually it was swapping. I assumed DNS was resolving — it was cached stale."
  infrastructure_checks:
    description: Infrastructure health verification results
    hint: "Memory, CPU, disk, network, OS limits — what did you actually check?"
  dependency_status:
    description: Status of upstream and underlying dependencies
    hint: "Database, caches, message queues, external APIs, shared services — verified healthy or not?"
  root_cause_candidates:
    description: Potential root causes identified from the bottom up
    hint: "Which foundational issues could explain the symptoms?"

related_models:
  - id: top-down
    reason: "Combine with top-down for a pincer approach — verify both ends"
  - id: failure-modes
    reason: "Infrastructure failures are common failure modes"
  - id: caches
    reason: "Stale or exhausted caches are a common bottom-level issue"
```

`models/troubleshooting/top-down.yaml`:
```yaml
id: top-down
name: Top-Down
category: troubleshooting
tags: [pipeline, upstream, inputs, diagnostic]
description: >
  Trace from upstream down. Before blaming the component showing symptoms,
  verify that its inputs, pipelines, and preconditions are healthy. The
  problem may be upstream of where the symptoms appear.

guiding_questions:
  - Does the upstream system function as it should?
  - Is DNS correct? Is data actually reaching our component?
  - What pipeline feeds into this component? Is it behaving correctly?
  - Are we assuming the pipeline ahead of this is healthy? Have we verified?
  - Is the data arriving in the expected format, volume, and frequency?
  - Could an upstream change (deploy, config, data shift) explain this?

required_fields:
  upstream_verification:
    description: Verification that upstream systems are functioning correctly
    hint: "Check each hop: DNS → load balancer → reverse proxy → app → dependencies"
  input_validation:
    description: Are inputs arriving in expected format, volume, and frequency?
    hint: "Garbage in, garbage out — is the input actually clean?"
  pipeline_health:
    description: Health of each stage in the pipeline feeding this component
    hint: "Which stages have you verified? Which are you assuming?"
  upstream_changes:
    description: Recent changes in upstream systems that could explain symptoms
    hint: "Deploys, config changes, data migrations, traffic pattern shifts"

related_models:
  - id: bottom-up
    reason: "Combine with bottom-up for a pincer approach"
  - id: source-sink
    reason: "Source/sink analysis formalizes the input/output tracing"
  - id: binary-search
    reason: "If top-down finds the problem is somewhere in the middle, bisect"
```

`models/troubleshooting/binary-search.yaml`:
```yaml
id: binary-search
name: Binary Search
category: troubleshooting
tags: [isolation, elimination, efficiency, diagnostic]
description: >
  Bisect the pipeline or call chain with yes/no tests to narrow the fault
  location logarithmically. Instead of checking every component, pick the
  midpoint, test, and eliminate half the search space each time.

guiding_questions:
  - Can you map the full pipeline from input to output?
  - Where is the midpoint of the pipeline?
  - What yes/no test can determine if the problem is before or after the midpoint?
  - Can you inject test data at the midpoint to isolate direction?
  - Are there natural checkpoints where you can observe state?
  - How many bisection steps would isolate the fault?

required_fields:
  pipeline_map:
    description: The full pipeline or call chain being investigated
    hint: "List each stage from input to output"
  test_points:
    description: Points where you can observe state or inject tests
    hint: "Logs, metrics, debug endpoints, database queries, tcpdump"
  bisection_log:
    description: Record of each bisection step and its result
    hint: "Test at midpoint → problem is after → test at 3/4 → problem is before → narrowed to stage 5-6"
  fault_location:
    description: The narrowed-down location of the fault
    hint: "After N bisection steps, the problem is in this specific component/stage"

related_models:
  - id: top-down
    reason: "Top-down establishes the pipeline; binary search bisects it"
  - id: bottom-up
    reason: "Once fault is located, bottom-up verifies the root cause"
```

`models/troubleshooting/parallelism.yaml`:
```yaml
id: parallelism
name: Parallelism
category: troubleshooting
tags: [concurrency, deadlock, race-condition, diagnostic]
description: >
  Examine the system through the lens of parallel and concurrent execution.
  Look for deadlocks, race conditions, ordering assumptions, and resource
  contention that only manifest under concurrent load.

guiding_questions:
  - What executes concurrently in this system? Threads, processes, async tasks?
  - Are there shared resources accessed by multiple concurrent actors?
  - What locking or synchronization mechanisms are in place?
  - Can operations execute in a different order than expected?
  - Does the bug only reproduce under load or specific timing?
  - Are there assumptions about execution order that are not enforced?

required_fields:
  concurrent_actors:
    description: What executes concurrently and how
    hint: "Threads, processes, workers, async handlers, cron jobs, user requests"
  shared_resources:
    description: Resources accessed by multiple concurrent actors
    hint: "Database rows, files, cache keys, in-memory state, connection pools"
  synchronization_mechanisms:
    description: How concurrent access is controlled
    hint: "Locks, mutexes, transactions, queues, optimistic concurrency, CAS"
  race_conditions:
    description: Potential or confirmed race conditions
    hint: "Read-modify-write without locking, check-then-act gaps, double-processing"

related_models:
  - id: queuing-theory
    reason: "Contention creates queuing effects"
  - id: failure-modes
    reason: "Deadlocks and races are failure modes specific to concurrent systems"
```

`models/troubleshooting/caches.yaml`:
```yaml
id: caches
name: Caches
category: troubleshooting
tags: [staleness, invalidation, ttl, layers, diagnostic]
description: >
  Audit all caching layers for invalidation issues and staleness.
  Take a broad view — caches exist at every level from CPU to CDN.
  Cache invalidation is one of the two hard problems for a reason.

guiding_questions:
  - What caches are in play? List every layer from app to network edge.
  - How does each cache update? TTL, event-driven, manual purge?
  - How does each cache invalidate? Is invalidation reliable?
  - Could something be stale? What would stale data look like?
  - Are there caches you might not think of? (DNS, OS page cache, ORM query cache, CDN, search index replication)
  - Is a thundering herd or cache stampede possible?

required_fields:
  cache_layers:
    description: All caching layers identified in the system
    hint: "Application cache, Redis/Memcached, database query cache, ORM cache, HTTP cache, CDN, DNS cache, OS page cache, /dev/shm, search index (OpenSearch reindexing is a cache)"
  invalidation_mechanisms:
    description: How each cache invalidates and whether it is reliable
    hint: "TTL, pub/sub, manual purge, write-through, write-behind — which ones have gaps?"
  staleness_assessment:
    description: Could stale data explain the symptoms?
    hint: "Check each layer — is the data current? When was it last refreshed?"
  stampede_risk:
    description: Risk of cache stampede or thundering herd
    hint: "What happens when a popular cache entry expires and 1000 requests hit the origin simultaneously?"

related_models:
  - id: bottom-up
    reason: "Stale caches are a common foundational issue"
  - id: buffers
    reason: "Caches are a form of buffer — sizing and overflow rules apply"
  - id: feedback-loops
    reason: "Cache invalidation failures can create reinforcing failure loops"
```

- [ ] **Step 2: Commit**

```bash
git add models/troubleshooting/
git commit -m "feat: add 5 troubleshooting model definitions"
```

---

## Chunk 7: Integration & Smoke Test

### Task 15: Build and smoke test

**Files:**
- No new files — integration verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (loader, matcher, server)

- [ ] **Step 2: Build the project**

Run: `npm run build`
Expected: Clean build, `dist/` contains `index.js`, `server.js`, `loader.js`, `matcher.js`, `types.js`

- [ ] **Step 3: Smoke test — verify the server starts and loads all 18 models**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}' | node dist/index.js 2>&1 | head -20`

Expected: stderr shows "Systems Thinking MCP Server loaded 18 models" with all models listed, plus JSON-RPC response on stdout.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: verify build and smoke test"
```

---

### Task 16: Add MCP configuration example to README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write minimal README**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with install and usage instructions"
```
