import { z } from "zod";

// --- Model Definition (loaded from YAML) ---

export interface RequiredFieldDef {
  description: string;
  hint: string;
}

export interface RelatedModel {
  id: string;
  reason: string;
}

export interface CounterbalanceModel {
  id: string;
  tension: string; // What productive tension does this create?
}

export interface ModelDefinition {
  id: string;
  name: string;
  category: string; // Set by directory, not YAML
  tags: string[];
  description: string;
  guiding_questions: string[];
  required_fields: Record<string, RequiredFieldDef>;
  related_models: RelatedModel[];
  counterbalances: CounterbalanceModel[];
}

// --- Session State ---

export interface LensApplication {
  modelId: string;
  analysis: string;
  findings: Record<string, string>;
  observations?: string;
  confidence?: "low" | "medium" | "high";
  appliedAt: number;
}

export interface Session {
  id: string;
  problem: string;
  context?: string;
  scope?: string;
  lenses: LensApplication[];
  startedAt: number;
}

// --- Tool I/O ---

export interface LensSuggestion {
  modelId: string;
  name: string;
  reason: string;
  guidingQuestions: string[];
  requiredFields: Record<string, RequiredFieldDef>;
}

export interface CrossReference {
  fromLens: string;
  findingKey: string;
  findingExcerpt: string;
  relevance: string;
}

// --- Zod Schemas for tool inputs ---

export const StartAnalysisInput = z.object({
  problem: z.string().describe("What are we analyzing or troubleshooting?"),
  context: z.string().optional().describe("System description, constraints, environment"),
  scope: z.string().optional().describe("What is in or out of bounds for this analysis"),
});

export const ApplyLensInput = z.object({
  sessionId: z.string().describe("Session ID from start_analysis"),
  modelId: z.string().describe("Model to apply (e.g. 'queuing-theory', 'bottom-up')"),
  analysis: z.string().describe("Your analysis through this lens"),
  findings: z.record(z.string(), z.string()).describe("Model-specific findings keyed by required field names"),
  observations: z.string().optional().describe("Emergent insights outside the model template"),
  confidence: z.enum(["low", "medium", "high"]).optional().describe("Confidence in this analysis"),
  nextLens: z.string().optional().describe("Which lens you want to apply next"),
});

export const SynthesizeInput = z.object({
  sessionId: z.string().describe("Session ID from start_analysis"),
  synthesis: z.string().describe("Cross-lens integration of findings"),
  recommendations: z.array(z.string()).describe("Actionable outcomes from the analysis"),
  contradictions: z.string().optional().describe("Where lenses disagreed"),
  gaps: z.string().optional().describe("What was not examined"),
});
