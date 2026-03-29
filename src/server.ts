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
