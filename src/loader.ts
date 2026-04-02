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

      // Build categories: use YAML field if present, ensuring directory category is included
      const yamlCategories = (parsed.categories as string[]) || [];
      const categories = yamlCategories.length > 0
        ? (yamlCategories.includes(categoryDir) ? yamlCategories : [categoryDir, ...yamlCategories])
        : [categoryDir];

      const model: ModelDefinition = {
        id: parsed.id as string,
        name: parsed.name as string,
        category: categoryDir, // Directory is authoritative
        categories,
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
      concerns: (parsed.concerns as StrategyDefinition["concerns"]) || [],
    });
  }

  return strategies;
}

/**
 * Validate model definitions have all required fields properly formed.
 * Returns an array of human-readable error strings.
 */
export function validateModelDefinitions(
  models: ModelDefinition[]
): string[] {
  const errors: string[] = [];
  for (const m of models) {
    if (!m.name) {
      errors.push(`Model '${m.id}' is missing 'name'`);
    }
    if (!m.description) {
      errors.push(`Model '${m.id}' is missing 'description'`);
    }
    if (!m.guiding_questions || m.guiding_questions.length === 0) {
      errors.push(`Model '${m.id}' has no guiding_questions`);
    }
    // Validate required_fields: each must have description and hint
    for (const [key, field] of Object.entries(m.required_fields)) {
      if (!field.description) {
        errors.push(`Model '${m.id}' required_field '${key}' is missing 'description'`);
      }
      if (!field.hint) {
        errors.push(`Model '${m.id}' required_field '${key}' is missing 'hint'`);
      }
    }
    // Validate related_models: each must have id and reason
    for (const rel of m.related_models) {
      if (!rel.id) {
        errors.push(`Model '${m.id}' has a related_model missing 'id'`);
      }
      if (!rel.reason) {
        errors.push(`Model '${m.id}' has a related_model missing 'reason'`);
      }
    }
    // Validate counterbalances: each must have id and tension
    for (const cb of m.counterbalances) {
      if (!cb.id) {
        errors.push(`Model '${m.id}' has a counterbalance missing 'id'`);
      }
      if (!cb.tension) {
        errors.push(`Model '${m.id}' has a counterbalance missing 'tension'`);
      }
    }
  }
  return errors;
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
 * Validate that all concern domains in strategies reference valid
 * category names. Returns an array of human-readable error strings,
 * or an empty array if all references are valid.
 */
export function validateStrategyReferences(
  strategies: StrategyDefinition[],
  categoryNames: Set<string>
): string[] {
  const errors: string[] = [];
  for (const strategy of strategies) {
    for (const concern of strategy.concerns) {
      if (!categoryNames.has(concern.domain)) {
        errors.push(
          `Strategy '${strategy.id}' concern references unknown category '${concern.domain}'`
        );
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
