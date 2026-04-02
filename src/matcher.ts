import type {
  ModelDefinition,
  LensSuggestion,
} from "./types.js";

export interface CounterbalanceSuggestion extends LensSuggestion {
  tension: string;
}

export interface ModelCluster {
  id: string;
  theme: string;
  description: string;
  modelIds: string[];
  categories: string[];
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
 * Compute model clusters from categories, enriched with graph metadata.
 *
 * Categories are human-curated boundaries. The relationship graph is used
 * elsewhere (expand_selection) to navigate between clusters, not to
 * override the taxonomy.
 */
export function computeClusters(models: ModelDefinition[]): ModelCluster[] {
  const modelMap = new Map(models.map((m) => [m.id, m]));

  // Group by primary category
  const groups = new Map<string, string[]>();
  for (const m of models) {
    if (!groups.has(m.category)) groups.set(m.category, []);
    groups.get(m.category)!.push(m.id);
  }

  // Build cluster objects
  const clusters: ModelCluster[] = [];
  let clusterIndex = 0;
  for (const [categoryName, memberIds] of groups) {
    clusterIndex++;
    const members = memberIds.map((id) => modelMap.get(id)!);

    // Theme: humanized category name
    const theme = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);

    const description = `${members.length} models: ${members.map((m) => m.name).join(", ")}`;

    clusters.push({
      id: categoryName,
      theme,
      description,
      modelIds: memberIds.sort(),
      categories: [categoryName],
    });
  }

  clusters.sort((a, b) => b.modelIds.length - a.modelIds.length);
  return clusters;
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
