import type {
  ModelDefinition,
  LensApplication,
  LensSuggestion,
  CrossReference,
  CounterbalanceModel,
} from "./types.js";

export interface CounterbalanceSuggestion extends LensSuggestion {
  tension: string;
}

const STOP_WORDS = new Set([
  "the", "be", "to", "of", "and", "in", "that", "have", "it", "for",
  "not", "on", "with", "he", "as", "you", "do", "at", "this", "but",
  "his", "by", "from", "they", "we", "her", "she", "or", "an", "will",
  "my", "one", "all", "would", "there", "their", "what", "so", "up",
  "out", "if", "about", "who", "get", "which", "go", "me", "when",
  "make", "can", "like", "no", "just", "him", "know", "take",
  "into", "your", "some", "could", "them", "than", "other", "how",
  "then", "its", "our", "these", "also", "after", "use", "two",
  "more", "very", "much", "before", "any", "where", "most", "been",
  "has", "was", "are", "is", "does", "did", "had", "may", "each",
  "should", "over", "such", "through", "own",
]);

/**
 * Tokenize text into lowercase words for matching,
 * filtering out common English stop words.
 */
export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
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

const MIN_CROSS_REF_OVERLAP = 2;

/**
 * Find cross-references between prior lens findings and the current model.
 * Scans prior findings values for meaningful (non-stop-word) terms that
 * appear in the current model's tags, description, guiding questions,
 * and required field descriptions/hints.
 *
 * Requires at least MIN_CROSS_REF_OVERLAP meaningful shared terms to
 * qualify as a cross-reference. Results are scored by overlap count
 * and sorted by score descending.
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
      if (overlap.length >= MIN_CROSS_REF_OVERLAP) {
        refs.push({
          fromLens: lens.modelId,
          findingKey: key,
          findingExcerpt: value.length > 200 ? value.slice(0, 200) + "..." : value,
          relevance: `Shared terms: ${overlap.slice(0, 5).join(", ")}`,
          score: overlap.length,
        });
      }
    }
  }

  refs.sort((a, b) => b.score - a.score);

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

/**
 * Get counterbalancing model suggestions — models that provide a
 * deliberately opposing perspective to create productive tension.
 */
export function getCounterbalanceSuggestions(
  currentModel: ModelDefinition,
  allModels: ModelDefinition[],
  appliedModelIds: string[]
): CounterbalanceSuggestion[] {
  const applied = new Set(appliedModelIds);
  const modelMap = new Map(allModels.map((m) => [m.id, m]));

  return currentModel.counterbalances
    .filter((c) => !applied.has(c.id) && modelMap.has(c.id))
    .map((c) => {
      const model = modelMap.get(c.id)!;
      return {
        modelId: model.id,
        name: model.name,
        reason: `COUNTERBALANCE: ${c.tension}`,
        tension: c.tension,
        guidingQuestions: model.guiding_questions,
        requiredFields: model.required_fields,
      };
    });
}
