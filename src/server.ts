import { randomUUID } from "crypto";
import type {
  ModelDefinition,
  Session,
  LensApplication,
  LensSuggestion,
  CrossReference,
} from "./types.js";
import { suggestLenses, suggestLensesWithGraph, findCrossReferences, getRelatedSuggestions, getCounterbalanceSuggestions, computeClusters } from "./matcher.js";
import type { CounterbalanceSuggestion, ModelCluster } from "./matcher.js";

export class SystemsThinkingServer {
  private models: ModelDefinition[];
  private modelMap: Map<string, ModelDefinition>;
  private sessions: Map<string, Session> = new Map();

  constructor(models: ModelDefinition[]) {
    this.models = models;
    this.modelMap = new Map(models.map((m) => [m.id, m]));
  }

  getModel(id: string): ModelDefinition | undefined {
    return this.modelMap.get(id);
  }

  startAnalysis(input: {
    problem: string;
    context?: string;
    scope?: string;
  }): {
    sessionId: string;
    problem: string;
    clusters: ModelCluster[];
    workflow: string;
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

    const clusters = computeClusters(this.models);

    return {
      sessionId,
      problem: input.problem,
      clusters,
      workflow: "Review the clusters above. Pick 1-3 relevant clusters or specific models, then call expand_selection to get full model details and graph neighbors before applying lenses.",
    };
  }

  expandSelection(input: {
    sessionId: string;
    modelIds: string[];
  }): {
    selected?: Array<{
      id: string;
      name: string;
      description: string;
      guidingQuestions: string[];
      requiredFields: ModelDefinition["required_fields"];
    }>;
    graphNeighbors?: Array<{
      modelId: string;
      name: string;
      relationship: string;
      from: string;
    }>;
    counterbalances?: Array<{
      modelId: string;
      name: string;
      tension: string;
      for: string;
    }>;
    uncoveredCategories?: string[];
    error?: string;
    availableSessions?: string[];
  } {
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      return {
        error: `Session not found: ${input.sessionId}`,
        availableSessions: [...this.sessions.keys()],
      };
    }

    const selectedIds = new Set(input.modelIds);

    // Build selected model details
    const selected = input.modelIds
      .map((id) => this.modelMap.get(id))
      .filter((m): m is ModelDefinition => m !== undefined)
      .map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description.trim(),
        guidingQuestions: m.guiding_questions,
        requiredFields: m.required_fields,
      }));

    // Walk graph: collect related_models from all selected, excluding selected models
    const neighborMap = new Map<string, { relationship: string; from: string }>();
    const counterbalanceMap = new Map<string, { tension: string; for: string }>();

    for (const id of input.modelIds) {
      const model = this.modelMap.get(id);
      if (!model) continue;

      for (const rel of model.related_models) {
        if (!selectedIds.has(rel.id) && this.modelMap.has(rel.id) && !neighborMap.has(rel.id)) {
          neighborMap.set(rel.id, { relationship: rel.reason, from: id });
        }
      }
      for (const cb of model.counterbalances) {
        if (!selectedIds.has(cb.id) && this.modelMap.has(cb.id) && !counterbalanceMap.has(cb.id)) {
          counterbalanceMap.set(cb.id, { tension: cb.tension, for: id });
        }
      }
    }

    const graphNeighbors = [...neighborMap.entries()].map(([id, info]) => ({
      modelId: id,
      name: this.modelMap.get(id)!.name,
      relationship: info.relationship,
      from: info.from,
    }));

    const counterbalances = [...counterbalanceMap.entries()].map(([id, info]) => ({
      modelId: id,
      name: this.modelMap.get(id)!.name,
      tension: info.tension,
      for: info.for,
    }));

    // Find uncovered categories
    const coveredCategories = new Set<string>();
    for (const id of input.modelIds) {
      const m = this.modelMap.get(id);
      if (m) coveredCategories.add(m.category);
    }
    const allCategories = new Set(this.models.map((m) => m.category));
    const uncoveredCategories = [...allCategories].filter((c) => !coveredCategories.has(c)).sort();

    return {
      selected,
      graphNeighbors,
      counterbalances,
      uncoveredCategories,
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
    sessionSummary?: { problem: string; lensesApplied: string[] };
    analysisDepth?: string;
    nextSteps?: {
      counterbalances: CounterbalanceSuggestion[];
      complementary: LensSuggestion[];
      message: string;
    };
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

    // Suggested next lenses: counterbalances + related + tag matching
    const appliedIds = session.lenses.map((l) => l.modelId);
    const counterbalances = getCounterbalanceSuggestions(model, this.models, appliedIds);
    const relatedSuggestions = getRelatedSuggestions(model, this.models, appliedIds);

    const searchText = [session.problem, session.context, session.scope]
      .filter(Boolean)
      .join(" ");
    const tagSuggestions = suggestLenses(searchText, this.models, appliedIds, 3);

    // Merge complementary: related first, then tag-based, deduplicate, exclude counterbalances
    const counterbalanceIds = new Set(counterbalances.map((c) => c.modelId));
    const seen = new Set<string>();
    const complementary: LensSuggestion[] = [];
    for (const s of [...relatedSuggestions, ...tagSuggestions]) {
      if (!seen.has(s.modelId) && !counterbalanceIds.has(s.modelId)) {
        seen.add(s.modelId);
        complementary.push(s);
      }
    }

    // Analysis depth based on lens count
    const lensCount = session.lenses.length;
    const analysisDepth = lensCount === 1 ? "shallow — single perspective only"
      : lensCount === 2 ? "moderate — two perspectives applied"
      : `thorough — ${lensCount} perspectives applied`;

    // Next steps message
    const depthMessage = lensCount < 3
      ? `Lens ${lensCount} applied. Apply ${3 - lensCount} more before synthesizing for meaningful cross-lens insight.`
      : `${lensCount} lenses applied — good depth. Consider synthesizing now, or apply another lens if gaps remain.`;

    return {
      modelId: input.modelId,
      guidingQuestions: model.guiding_questions,
      requiredFields: model.required_fields,
      missingFields,
      crossReferences,
      sessionSummary: {
        problem: session.problem,
        lensesApplied: session.lenses.map((l) => l.modelId),
      },
      analysisDepth,
      nextSteps: {
        counterbalances: counterbalances.slice(0, 2),
        complementary: complementary.slice(0, 2),
        message: depthMessage,
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
    connectionsFound?: Array<{
      between: [string, string];
      connection: string;
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

    // Find cross-lens connections: for each lens pair, find cross-references
    const connectionsFound: Array<{
      between: [string, string];
      connection: string;
    }> = [];
    for (let i = 0; i < session.lenses.length; i++) {
      for (let j = i + 1; j < session.lenses.length; j++) {
        const laterModel = this.modelMap.get(session.lenses[j].modelId);
        if (!laterModel) continue;
        const refs = findCrossReferences([session.lenses[i]], laterModel);
        for (const ref of refs) {
          connectionsFound.push({
            between: [session.lenses[i].modelId, session.lenses[j].modelId],
            connection: `${ref.fromLens}/${ref.findingKey} ↔ ${session.lenses[j].modelId}: ${ref.relevance}`,
          });
        }
      }
    }

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
      connectionsFound,
      synthesis: input.synthesis,
      recommendations: input.recommendations,
      contradictions: input.contradictions,
      gaps: input.gaps,
      suggestedAdditionalLenses,
      warning,
    };
  }
}
