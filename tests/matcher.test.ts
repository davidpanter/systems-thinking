import { describe, it, expect } from "vitest";
import { suggestLenses, findCrossReferences } from "../src/matcher.js";
import type { ModelDefinition, LensApplication } from "../src/types.js";

const mockModels: ModelDefinition[] = [
  {
    id: "queuing-theory",
    name: "Queuing Theory",
    category: "operations",
    tags: ["throughput", "latency", "waiting", "load"],
    description: "Analyze arrival rates, service rates, wait times, and queue stability",
    guiding_questions: ["Where do requests queue up?"],
    required_fields: {
      arrival_rate: { description: "Request arrival rate", hint: "Requests per second" },
    },
    related_models: [{ id: "buffers", reason: "Buffers absorb queue overflow" }],
  },
  {
    id: "bottom-up",
    name: "Bottom-Up",
    category: "troubleshooting",
    tags: ["infrastructure", "dependencies", "assumptions", "diagnostic"],
    description: "Start from foundations, challenge assumptions about infrastructure",
    guiding_questions: ["Is the infrastructure healthy?"],
    required_fields: {
      assumptions_challenged: { description: "Assumptions tested", hint: "What did you verify?" },
    },
    related_models: [],
  },
  {
    id: "caches",
    name: "Caches",
    category: "troubleshooting",
    tags: ["staleness", "invalidation", "ttl", "layers", "diagnostic"],
    description: "Audit all caching layers for invalidation and staleness issues",
    guiding_questions: ["What caches are in play?"],
    required_fields: {
      cache_layers: { description: "Identified cache layers", hint: "List all caches" },
    },
    related_models: [],
  },
];

describe("suggestLenses", () => {
  it("matches problem text against model tags", () => {
    const suggestions = suggestLenses("high latency and slow throughput", mockModels, []);
    expect(suggestions[0].modelId).toBe("queuing-theory");
  });

  it("matches against description text", () => {
    const suggestions = suggestLenses("caching layers seem stale", mockModels, []);
    const ids = suggestions.map((s) => s.modelId);
    expect(ids).toContain("caches");
  });

  it("excludes already-applied lenses", () => {
    const suggestions = suggestLenses("high latency", mockModels, ["queuing-theory"]);
    const ids = suggestions.map((s) => s.modelId);
    expect(ids).not.toContain("queuing-theory");
  });

  it("returns at most maxResults suggestions", () => {
    const suggestions = suggestLenses("infrastructure diagnostic latency caching", mockModels, [], 2);
    expect(suggestions.length).toBeLessThanOrEqual(2);
  });

  it("includes guidingQuestions and requiredFields in suggestions", () => {
    const suggestions = suggestLenses("latency", mockModels, []);
    const qt = suggestions.find((s) => s.modelId === "queuing-theory");
    expect(qt?.guidingQuestions).toEqual(["Where do requests queue up?"]);
    expect(qt?.requiredFields.arrival_rate).toBeDefined();
  });
});

describe("findCrossReferences", () => {
  const priorLenses: LensApplication[] = [
    {
      modelId: "bottom-up",
      analysis: "Checked infrastructure",
      findings: {
        assumptions_challenged: "Redis cache memory at 95% capacity, possible cache invalidation pressure",
      },
      appliedAt: Date.now(),
    },
  ];

  it("finds keyword matches between prior findings and current model", () => {
    const cacheModel = mockModels.find((m) => m.id === "caches")!;
    const refs = findCrossReferences(priorLenses, cacheModel);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0].fromLens).toBe("bottom-up");
    expect(refs[0].findingKey).toBe("assumptions_challenged");
  });

  it("returns empty array when no prior lenses", () => {
    const cacheModel = mockModels.find((m) => m.id === "caches")!;
    const refs = findCrossReferences([], cacheModel);
    expect(refs).toEqual([]);
  });
});
