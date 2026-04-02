import { describe, it, expect } from "vitest";
import { loadModelsFromDirectory, loadModels, validateStrategyReferences } from "../src/loader.js";
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
  it("returns no errors when all lens references are valid", () => {
    const modelIds = new Set(["model-a", "model-b", "model-c"]);
    const strategies = [
      {
        id: "test-strategy",
        name: "Test",
        description: "test",
        tracks: {
          track1: { lenses: ["model-a", "model-b"], focus: "test" },
          track2: { lenses: ["model-c"], focus: "test" },
        },
      },
    ];
    const errors = validateStrategyReferences(strategies, modelIds);
    expect(errors).toEqual([]);
  });

  it("returns errors for invalid lens references", () => {
    const modelIds = new Set(["model-a"]);
    const strategies = [
      {
        id: "test-strategy",
        name: "Test",
        description: "test",
        tracks: {
          track1: { lenses: ["model-a", "nonexistent"], focus: "test" },
        },
      },
    ];
    const errors = validateStrategyReferences(strategies, modelIds);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("test-strategy");
    expect(errors[0]).toContain("track1");
    expect(errors[0]).toContain("nonexistent");
  });

  it("reports all invalid references across multiple strategies and tracks", () => {
    const modelIds = new Set(["model-a"]);
    const strategies = [
      {
        id: "strategy-1",
        name: "S1",
        description: "test",
        tracks: {
          t1: { lenses: ["model-a", "bad-1"], focus: "test" },
          t2: { lenses: ["bad-2"], focus: "test" },
        },
      },
      {
        id: "strategy-2",
        name: "S2",
        description: "test",
        tracks: {
          t1: { lenses: ["bad-3"], focus: "test" },
        },
      },
    ];
    const errors = validateStrategyReferences(strategies, modelIds);
    expect(errors).toHaveLength(3);
  });
});
