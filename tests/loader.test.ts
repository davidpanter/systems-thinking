import { describe, it, expect } from "vitest";
import { loadModelsFromDirectory, loadModels, validateStrategyReferences, validateModelDefinitions } from "../src/loader.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures", "test-models");
const customDir = path.join(__dirname, "fixtures", "custom-models");

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

describe("multi-facet categories", () => {
  it("populates categories array from YAML when present", async () => {
    const models = await loadModelsFromDirectory(fixturesDir);
    const multiModel = models.find((m) => m.id === "multi-category-model")!;
    expect(multiModel).toBeDefined();
    expect(multiModel.categories).toEqual(["operations", "troubleshooting", "reliability"]);
  });

  it("defaults categories to [category] when not specified in YAML", async () => {
    const models = await loadModelsFromDirectory(fixturesDir);
    const testModel = models.find((m) => m.id === "test-model")!;
    // No categories in YAML, should default to directory-based category
    expect(testModel.categories).toEqual(["operations"]);
  });

  it("always includes directory category in categories even if not listed", async () => {
    const models = await loadModelsFromDirectory(fixturesDir);
    const multiModel = models.find((m) => m.id === "multi-category-model")!;
    // Directory is "operations", and it should be in categories
    expect(multiModel.categories).toContain("operations");
    // Primary category field still comes from directory
    expect(multiModel.category).toBe("operations");
  });
});

describe("validateStrategyReferences", () => {
  it("returns no errors when all concern domains are valid categories", () => {
    const categoryNames = new Set(["security", "architecture", "reasoning"]);
    const strategies = [
      {
        id: "test-strategy",
        name: "Test",
        description: "test",
        concerns: [
          { domain: "security", focus: "test", weight: "required" as const },
          { domain: "architecture", focus: "test", weight: "conditional" as const },
        ],
      },
    ];
    const errors = validateStrategyReferences(strategies, categoryNames);
    expect(errors).toEqual([]);
  });

  it("returns errors for invalid concern domains", () => {
    const categoryNames = new Set(["security"]);
    const strategies = [
      {
        id: "test-strategy",
        name: "Test",
        description: "test",
        concerns: [
          { domain: "security", focus: "test", weight: "required" as const },
          { domain: "nonexistent", focus: "test", weight: "required" as const },
        ],
      },
    ];
    const errors = validateStrategyReferences(strategies, categoryNames);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("test-strategy");
    expect(errors[0]).toContain("nonexistent");
  });

  it("reports all invalid references across multiple strategies", () => {
    const categoryNames = new Set(["security"]);
    const strategies = [
      {
        id: "strategy-1",
        name: "S1",
        description: "test",
        concerns: [
          { domain: "bad-1", focus: "test", weight: "required" as const },
          { domain: "bad-2", focus: "test", weight: "required" as const },
        ],
      },
      {
        id: "strategy-2",
        name: "S2",
        description: "test",
        concerns: [
          { domain: "bad-3", focus: "test", weight: "required" as const },
        ],
      },
    ];
    const errors = validateStrategyReferences(strategies, categoryNames);
    expect(errors).toHaveLength(3);
  });
});

describe("validateModelDefinitions", () => {
  it("returns no errors for well-formed models", () => {
    const models = [
      {
        id: "test", name: "Test", category: "cat", categories: ["cat"],
        tags: ["t"], description: "desc",
        guiding_questions: ["?"],
        required_fields: { f: { description: "d", hint: "h" } },
        related_models: [{ id: "other", reason: "r" }],
        counterbalances: [{ id: "cb", tension: "t" }],
      },
    ];
    const errors = validateModelDefinitions(models);
    expect(errors).toEqual([]);
  });

  it("catches missing hint on required_fields", () => {
    const models = [
      {
        id: "bad", name: "Bad", category: "cat", categories: ["cat"],
        tags: ["t"], description: "desc",
        guiding_questions: ["?"],
        required_fields: { f: { description: "d" } },
        related_models: [], counterbalances: [],
      },
    ];
    const errors = validateModelDefinitions(models as any);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("bad");
    expect(errors[0]).toContain("hint");
  });

  it("catches missing reason on related_models", () => {
    const models = [
      {
        id: "bad", name: "Bad", category: "cat", categories: ["cat"],
        tags: ["t"], description: "desc",
        guiding_questions: ["?"],
        required_fields: { f: { description: "d", hint: "h" } },
        related_models: [{ id: "other" }],
        counterbalances: [],
      },
    ];
    const errors = validateModelDefinitions(models as any);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("bad");
    expect(errors[0]).toContain("reason");
  });

  it("catches missing tension on counterbalances", () => {
    const models = [
      {
        id: "bad", name: "Bad", category: "cat", categories: ["cat"],
        tags: ["t"], description: "desc",
        guiding_questions: ["?"],
        required_fields: { f: { description: "d", hint: "h" } },
        related_models: [],
        counterbalances: [{ id: "cb" }],
      },
    ];
    const errors = validateModelDefinitions(models as any);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("bad");
    expect(errors[0]).toContain("tension");
  });

  it("catches missing required top-level fields", () => {
    const models = [
      {
        id: "bad", category: "cat", categories: ["cat"],
        tags: [], description: "",
        guiding_questions: [],
        required_fields: {},
        related_models: [], counterbalances: [],
      },
    ];
    const errors = validateModelDefinitions(models as any);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e: string) => e.includes("name"))).toBe(true);
  });

  it("validates all 53 built-in models pass", async () => {
    const builtinDir = path.join(__dirname, "..", "models");
    const models = await loadModelsFromDirectory(builtinDir);
    const errors = validateModelDefinitions(models);
    expect(errors).toEqual([]);
  });
});
