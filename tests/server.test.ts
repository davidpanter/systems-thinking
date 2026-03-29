import { describe, it, expect, beforeEach } from "vitest";
import { SystemsThinkingServer } from "../src/server.js";
import type { ModelDefinition } from "../src/types.js";

const testModels: ModelDefinition[] = [
  {
    id: "constraints",
    name: "Constraint Analysis",
    category: "operations",
    tags: ["bottleneck", "throughput", "capacity", "planning"],
    description: "Find the binding constraint limiting system throughput",
    guiding_questions: [
      "Where does work pile up?",
      "Which component limits the whole system?",
    ],
    required_fields: {
      binding_constraint: {
        description: "The single constraint limiting the system",
        hint: "Which one dominates?",
      },
      exploitation: {
        description: "How to maximize throughput at the constraint",
        hint: "Are we fully using what we have?",
      },
    },
    related_models: [
      { id: "queuing-theory", reason: "Quantify wait times at constraint" },
    ],
  },
  {
    id: "queuing-theory",
    name: "Queuing Theory",
    category: "operations",
    tags: ["throughput", "latency", "waiting", "load"],
    description: "Analyze arrival rates, service rates, and wait times",
    guiding_questions: ["Where do requests queue?"],
    required_fields: {
      arrival_rate: {
        description: "Request arrival rate",
        hint: "Requests per second",
      },
    },
    related_models: [],
  },
];

describe("SystemsThinkingServer", () => {
  let server: SystemsThinkingServer;

  beforeEach(() => {
    server = new SystemsThinkingServer(testModels);
  });

  describe("startAnalysis", () => {
    it("creates a session and returns sessionId", () => {
      const result = server.startAnalysis({
        problem: "System is slow under load",
      });
      expect(result.sessionId).toBeDefined();
      expect(result.problem).toBe("System is slow under load");
    });

    it("suggests lenses based on problem text", () => {
      const result = server.startAnalysis({
        problem: "throughput bottleneck causing high latency",
      });
      expect(result.suggestedLenses.length).toBeGreaterThan(0);
    });

    it("creates independent sessions on duplicate calls", () => {
      const r1 = server.startAnalysis({ problem: "Problem A" });
      const r2 = server.startAnalysis({ problem: "Problem B" });
      expect(r1.sessionId).not.toBe(r2.sessionId);
      server.applyLens({
        sessionId: r1.sessionId,
        modelId: "constraints",
        analysis: "test",
        findings: { binding_constraint: "X", exploitation: "Y" },
      });
      const synth = server.synthesize({
        sessionId: r2.sessionId,
        synthesis: "empty",
        recommendations: [],
      });
      expect(synth.lensesApplied).toHaveLength(0);
    });
  });

  describe("applyLens", () => {
    it("applies a valid lens to an existing session", () => {
      const { sessionId } = server.startAnalysis({
        problem: "System bottleneck",
      });
      const result = server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "The database is the bottleneck",
        findings: {
          binding_constraint: "Database write throughput",
          exploitation: "Add connection pooling",
        },
      });
      expect(result.modelId).toBe("constraints");
      expect(result.missingFields).toEqual([]);
    });

    it("returns missingFields for incomplete findings", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "Partial analysis",
        findings: { binding_constraint: "DB writes" },
      });
      expect(result.missingFields).toContain("exploitation");
    });

    it("returns error with available sessions for invalid sessionId", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.applyLens({
        sessionId: "nonexistent",
        modelId: "constraints",
        analysis: "test",
        findings: {},
      });
      expect(result.error).toContain("Session not found");
      expect(result.availableSessions).toContain(sessionId);
    });

    it("returns error for unknown modelId", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.applyLens({
        sessionId,
        modelId: "nonexistent",
        analysis: "test",
        findings: {},
      });
      expect(result.error).toBeDefined();
      expect(result.availableModels).toBeDefined();
    });

    it("returns suggestedNextLenses from related_models", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "Found bottleneck",
        findings: {
          binding_constraint: "DB",
          exploitation: "Pooling",
        },
      });
      const ids = result.suggestedNextLenses!.map((s) => s.modelId);
      expect(ids).toContain("queuing-theory");
    });

    it("excludes already-applied lenses from suggestedNextLenses", () => {
      const { sessionId } = server.startAnalysis({ problem: "throughput bottleneck" });
      server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "Found bottleneck",
        findings: { binding_constraint: "DB", exploitation: "Pooling" },
      });
      const result = server.applyLens({
        sessionId,
        modelId: "queuing-theory",
        analysis: "Analyzing queues",
        findings: { arrival_rate: "500/s" },
      });
      const ids = result.suggestedNextLenses!.map((s) => s.modelId);
      expect(ids).not.toContain("constraints");
      expect(ids).not.toContain("queuing-theory");
    });

    it("returns crossReferences from prior lenses", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "Found bottleneck",
        findings: {
          binding_constraint: "Request arrival rate exceeds capacity",
          exploitation: "Limit concurrent requests",
        },
      });
      const result = server.applyLens({
        sessionId,
        modelId: "queuing-theory",
        analysis: "Analyzing queues",
        findings: { arrival_rate: "500 req/s" },
      });
      expect(result.crossReferences).toBeDefined();
    });
  });

  describe("synthesize", () => {
    it("returns full session with synthesis", () => {
      const { sessionId } = server.startAnalysis({ problem: "Slow system" });
      server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "DB bottleneck",
        findings: {
          binding_constraint: "DB writes",
          exploitation: "Connection pooling",
        },
      });
      const result = server.synthesize({
        sessionId,
        synthesis: "The DB is the core issue",
        recommendations: ["Add read replicas", "Implement caching"],
      });
      expect(result.problem).toBe("Slow system");
      expect(result.lensesApplied).toHaveLength(1);
      expect(result.recommendations).toHaveLength(2);
    });

    it("warns when synthesizing with zero lenses", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.synthesize({
        sessionId,
        synthesis: "No lenses applied",
        recommendations: [],
      });
      expect(result.warning).toBeDefined();
    });

    it("returns error with available sessions for invalid sessionId", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.synthesize({
        sessionId: "nonexistent",
        synthesis: "test",
        recommendations: [],
      });
      expect(result.error).toContain("Session not found");
      expect(result.availableSessions).toContain(sessionId);
    });

    it("allows apply_lens after synthesize", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      server.synthesize({
        sessionId,
        synthesis: "Initial synthesis",
        recommendations: [],
      });
      const result = server.applyLens({
        sessionId,
        modelId: "queuing-theory",
        analysis: "Additional analysis",
        findings: { arrival_rate: "100/s" },
      });
      expect(result.modelId).toBe("queuing-theory");
    });
  });
});
