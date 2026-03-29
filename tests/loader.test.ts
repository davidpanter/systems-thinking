import { describe, it, expect } from "vitest";
import { loadModelsFromDirectory, loadModels } from "../src/loader.js";
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
