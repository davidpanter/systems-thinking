import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import type { ModelDefinition, StrategyDefinition } from "./types.js";

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
        counterbalances: (parsed.counterbalances as ModelDefinition["counterbalances"]) || [],
      };

      models.push(model);
    }
  }

  return models;
}

export async function loadStrategiesFromDirectory(
  dir: string
): Promise<StrategyDefinition[]> {
  const strategies: StrategyDefinition[] = [];

  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }

  for (const file of files) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
    const filePath = path.join(dir, file);
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = yaml.load(content) as Record<string, unknown>;

    strategies.push({
      id: parsed.id as string,
      name: parsed.name as string,
      description: (parsed.description as string) || "",
      tracks: (parsed.tracks as StrategyDefinition["tracks"]) || {},
    });
  }

  return strategies;
}

export async function loadStrategies(
  builtinDir: string,
  customDir?: string
): Promise<StrategyDefinition[]> {
  const builtins = await loadStrategiesFromDirectory(builtinDir);

  if (!customDir) return builtins;

  const customs = await loadStrategiesFromDirectory(customDir);
  const customIds = new Set(customs.map((s) => s.id));

  const filtered = builtins.filter((s) => !customIds.has(s.id));
  return [...filtered, ...customs];
}

/**
 * Validate that all lens IDs referenced in strategy tracks exist in the
 * loaded model set. Returns an array of human-readable error strings,
 * or an empty array if all references are valid.
 */
export function validateStrategyReferences(
  strategies: StrategyDefinition[],
  modelIds: Set<string>
): string[] {
  const errors: string[] = [];
  for (const strategy of strategies) {
    for (const [trackName, track] of Object.entries(strategy.tracks)) {
      for (const lensId of track.lenses) {
        if (!modelIds.has(lensId)) {
          errors.push(
            `Strategy '${strategy.id}' track '${trackName}' references unknown model '${lensId}'`
          );
        }
      }
    }
  }
  return errors;
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
