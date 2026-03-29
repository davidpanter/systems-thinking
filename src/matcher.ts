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

  // Build token set from current model's tags, description, field descriptions, and guiding questions
  const modelText = [
    ...currentModel.tags,
    currentModel.description,
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
