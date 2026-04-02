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
    counterbalances: [
      { id: "kiss", tension: "Constraint optimization can add complexity — is the simplest solution good enough?" },
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
    counterbalances: [],
  },
  {
    id: "kiss",
    name: "KISS",
    category: "architecture",
    tags: ["simplicity", "complexity", "readability", "planning"],
    description: "Keep it simple — complexity is the enemy of reliability",
    guiding_questions: ["What is the simplest version?"],
    required_fields: {
      complexity_inventory: {
        description: "Sources of complexity",
        hint: "What could be simpler?",
      },
    },
    related_models: [],
    counterbalances: [
      { id: "constraints", tension: "Simplicity may ignore real bottlenecks that need targeted optimization" },
    ],
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

    it("returns model clusters grouped by category", () => {
      const result = server.startAnalysis({
        problem: "throughput bottleneck causing high latency",
      });
      expect(result.clusters.length).toBeGreaterThan(0);
      // Each cluster has required fields
      for (const c of result.clusters) {
        expect(c.id).toBeTruthy();
        expect(c.theme).toBeTruthy();
        expect(c.modelIds.length).toBeGreaterThan(0);
      }
    });

    it("returns workflow guidance", () => {
      const result = server.startAnalysis({
        problem: "throughput bottleneck",
      });
      expect(result.workflow).toBeTruthy();
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

    it("returns complementary lenses from related_models", () => {
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
      const ids = result.nextSteps!.complementary.map((s) => s.modelId);
      expect(ids).toContain("queuing-theory");
    });

    it("returns counterbalance suggestions", () => {
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
      expect(result.nextSteps!.counterbalances.length).toBeGreaterThan(0);
      expect(result.nextSteps!.counterbalances[0].modelId).toBe("kiss");
      expect(result.nextSteps!.counterbalances[0].tension).toBeDefined();
    });

    it("excludes already-applied lenses from next steps", () => {
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
      const allIds = [
        ...result.nextSteps!.complementary.map((s) => s.modelId),
        ...result.nextSteps!.counterbalances.map((s) => s.modelId),
      ];
      expect(allIds).not.toContain("constraints");
      expect(allIds).not.toContain("queuing-theory");
    });

    it("returns analysisDepth based on lens count", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const r1 = server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "First lens",
        findings: { binding_constraint: "DB", exploitation: "Pooling" },
      });
      expect(r1.analysisDepth).toContain("shallow");

      const r2 = server.applyLens({
        sessionId,
        modelId: "queuing-theory",
        analysis: "Second lens",
        findings: { arrival_rate: "500/s" },
      });
      expect(r2.analysisDepth).toContain("moderate");

      const r3 = server.applyLens({
        sessionId,
        modelId: "kiss",
        analysis: "Third lens",
        findings: { complexity_inventory: "Too complex" },
      });
      expect(r3.analysisDepth).toContain("thorough");
    });

    it("returns prior findings from earlier lenses", () => {
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
      expect(result.priorFindings).toBeDefined();
      expect(result.priorFindings).toHaveLength(1);
      expect(result.priorFindings![0].modelId).toBe("constraints");
      expect(result.priorFindings![0].findings.binding_constraint).toContain("arrival rate");
    });

    it("returns empty priorFindings on first lens", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "First lens",
        findings: { binding_constraint: "DB", exploitation: "Pooling" },
      });
      expect(result.priorFindings).toEqual([]);
    });
  });

  describe("synthesize", () => {
    it("returns full session with synthesis and connections", () => {
      const { sessionId } = server.startAnalysis({ problem: "Slow system" });
      server.applyLens({
        sessionId,
        modelId: "constraints",
        analysis: "DB bottleneck",
        findings: {
          binding_constraint: "DB writes cause throughput limit",
          exploitation: "Connection pooling",
        },
      });
      server.applyLens({
        sessionId,
        modelId: "queuing-theory",
        analysis: "Queue analysis",
        findings: {
          arrival_rate: "500 req/s exceeds throughput capacity",
        },
      });
      const result = server.synthesize({
        sessionId,
        synthesis: "The DB is the core issue",
        recommendations: ["Add read replicas", "Implement caching"],
      });
      expect(result.problem).toBe("Slow system");
      expect(result.lensesApplied).toHaveLength(2);
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

  describe("expandSelection", () => {
    it("returns full details for selected models", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.expandSelection({
        sessionId,
        modelIds: ["constraints"],
      });
      expect(result.selected).toHaveLength(1);
      expect(result.selected![0].id).toBe("constraints");
      expect(result.selected![0].guidingQuestions).toBeDefined();
      expect(result.selected![0].requiredFields).toBeDefined();
    });

    it("returns graph neighbors from related_models", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.expandSelection({
        sessionId,
        modelIds: ["constraints"],
      });
      // constraints has queuing-theory as a related model
      const neighborIds = result.graphNeighbors!.map((n) => n.modelId);
      expect(neighborIds).toContain("queuing-theory");
    });

    it("returns counterbalances", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.expandSelection({
        sessionId,
        modelIds: ["constraints"],
      });
      // constraints has kiss as counterbalance
      const cbIds = result.counterbalances!.map((c) => c.modelId);
      expect(cbIds).toContain("kiss");
    });

    it("deduplicates neighbors across multiple selected models", () => {
      const { sessionId } = server.startAnalysis({ problem: "test" });
      const result = server.expandSelection({
        sessionId,
        modelIds: ["constraints", "queuing-theory"],
      });
      // Neither selected model should appear as a neighbor
      const neighborIds = result.graphNeighbors!.map((n) => n.modelId);
      expect(neighborIds).not.toContain("constraints");
      expect(neighborIds).not.toContain("queuing-theory");
    });

    it("returns error for invalid session", () => {
      const result = server.expandSelection({
        sessionId: "nonexistent",
        modelIds: ["constraints"],
      });
      expect(result.error).toContain("Session not found");
    });
  });
});
