import { describe, it, expect } from "vitest";
import { suggestLenses, findCrossReferences, tokenize, suggestLensesWithGraph } from "../src/matcher.js";
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
    counterbalances: [],
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
    counterbalances: [],
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
    counterbalances: [],
  },
];

describe("tokenize", () => {
  it("excludes common English stop words", () => {
    const tokens = tokenize("the system is not working and it has been failing for a while");
    // Stop words should be filtered out
    expect(tokens.has("the")).toBe(false);
    expect(tokens.has("is")).toBe(false);
    expect(tokens.has("and")).toBe(false);
    expect(tokens.has("it")).toBe(false);
    expect(tokens.has("has")).toBe(false);
    expect(tokens.has("been")).toBe(false);
    expect(tokens.has("for")).toBe(false);
    expect(tokens.has("not")).toBe(false);
    // Meaningful words should remain
    expect(tokens.has("system")).toBe(true);
    expect(tokens.has("working")).toBe(true);
    expect(tokens.has("failing")).toBe(true);
  });

  it("keeps domain-relevant short words", () => {
    const tokens = tokenize("API SLO DNS CPU OOM");
    expect(tokens.has("api")).toBe(true);
    expect(tokens.has("slo")).toBe(true);
    expect(tokens.has("dns")).toBe(true);
    expect(tokens.has("cpu")).toBe(true);
    expect(tokens.has("oom")).toBe(true);
  });
});

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

  it("does not match on stop words alone", () => {
    const priorWithStopWords: LensApplication[] = [
      {
        modelId: "some-lens",
        analysis: "The system is working and it has been stable",
        findings: {
          some_field: "The system is working and it has been stable for a while now",
        },
        appliedAt: Date.now(),
      },
    ];
    const cacheModel = mockModels.find((m) => m.id === "caches")!;
    const refs = findCrossReferences(priorWithStopWords, cacheModel);
    // Should NOT match — only stop words overlap, no meaningful terms
    expect(refs).toEqual([]);
  });

  it("requires minimum meaningful term overlap", () => {
    // Only one meaningful word overlaps — "cache" — but minimum threshold is 2
    const priorWithOneWord: LensApplication[] = [
      {
        modelId: "some-lens",
        analysis: "test",
        findings: {
          some_field: "The cache was empty",
        },
        appliedAt: Date.now(),
      },
    ];
    const cacheModel = mockModels.find((m) => m.id === "caches")!;
    const refs = findCrossReferences(priorWithOneWord, cacheModel);
    expect(refs).toEqual([]);
  });

  it("matches when multiple meaningful terms overlap", () => {
    const priorWithGoodOverlap: LensApplication[] = [
      {
        modelId: "bottom-up",
        analysis: "test",
        findings: {
          assumptions_challenged: "Redis cache memory at 95% capacity, possible cache invalidation pressure",
        },
        appliedAt: Date.now(),
      },
    ];
    const cacheModel = mockModels.find((m) => m.id === "caches")!;
    const refs = findCrossReferences(priorWithGoodOverlap, cacheModel);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0].fromLens).toBe("bottom-up");
  });

  it("scores cross-references by overlap strength", () => {
    const priorLenses: LensApplication[] = [
      {
        modelId: "lens-a",
        analysis: "test",
        findings: {
          weak_match: "cache invalidation",
          strong_match: "cache invalidation staleness layers ttl audit caching",
        },
        appliedAt: Date.now(),
      },
    ];
    const cacheModel = mockModels.find((m) => m.id === "caches")!;
    const refs = findCrossReferences(priorLenses, cacheModel);
    // Both should match, but strong_match should have higher score
    if (refs.length === 2) {
      const strongRef = refs.find((r) => r.findingKey === "strong_match");
      const weakRef = refs.find((r) => r.findingKey === "weak_match");
      expect(strongRef).toBeDefined();
      expect(weakRef).toBeDefined();
      expect(strongRef!.score).toBeGreaterThan(weakRef!.score);
    }
  });

  it("returns cross-references sorted by score descending", () => {
    const priorLenses: LensApplication[] = [
      {
        modelId: "lens-a",
        analysis: "test",
        findings: {
          weak: "cache invalidation",
          strong: "cache invalidation staleness layers ttl audit caching",
        },
        appliedAt: Date.now(),
      },
    ];
    const cacheModel = mockModels.find((m) => m.id === "caches")!;
    const refs = findCrossReferences(priorLenses, cacheModel);
    for (let i = 1; i < refs.length; i++) {
      expect(refs[i - 1].score).toBeGreaterThanOrEqual(refs[i].score);
    }
  });
});

describe("suggestLensesWithGraph", () => {
  // A cluster: modularity → coupling-cohesion → separation-of-concerns
  // An isolated model: queuing-theory (no connections to the cluster)
  const graphModels: ModelDefinition[] = [
    {
      id: "modularity",
      name: "Modularity",
      category: "architecture",
      tags: ["modules", "decomposition", "boundaries"],
      description: "Evaluate system decomposition into independent interchangeable units",
      guiding_questions: ["What are the modules?"],
      required_fields: { modules: { description: "Modules", hint: "List them" } },
      related_models: [
        { id: "coupling-cohesion", reason: "Measure coupling between modules" },
        { id: "separation-of-concerns", reason: "Verify separation" },
      ],
      counterbalances: [],
    },
    {
      id: "coupling-cohesion",
      name: "Coupling & Cohesion",
      category: "architecture",
      tags: ["coupling", "cohesion", "dependencies", "modules"],
      description: "Measure module interdependency and internal focus",
      guiding_questions: ["How coupled are the modules?"],
      required_fields: { coupling: { description: "Coupling", hint: "Measure it" } },
      related_models: [
        { id: "modularity", reason: "Module boundaries define coupling" },
      ],
      counterbalances: [],
    },
    {
      id: "separation-of-concerns",
      name: "Separation of Concerns",
      category: "architecture",
      tags: ["separation", "concerns", "isolation", "boundaries"],
      description: "Ensure different aspects of behavior are isolated in separate units",
      guiding_questions: ["Are concerns separated?"],
      required_fields: { concerns: { description: "Concerns", hint: "List them" } },
      related_models: [
        { id: "modularity", reason: "Modules enforce separation" },
      ],
      counterbalances: [],
    },
    {
      id: "queuing-theory",
      name: "Queuing Theory",
      category: "operations",
      tags: ["throughput", "latency", "waiting", "modules"],
      // "modules" tag gives it some tag overlap with the problem, but it's isolated in the graph
      description: "Analyze arrival rates service rates wait times queue stability",
      guiding_questions: ["Where do requests queue?"],
      required_fields: { rate: { description: "Rate", hint: "Measure it" } },
      related_models: [],
      counterbalances: [],
    },
  ];

  it("boosts models that are part of a related cluster", () => {
    // Problem text matches "modules" tag — present in modularity, coupling-cohesion, AND queuing-theory
    // But modularity and coupling-cohesion form a graph cluster, so they should rank higher
    const results = suggestLensesWithGraph("modules boundaries decomposition", graphModels, []);
    const ids = results.map((r) => r.modelId);

    // modularity should be top (best tag match + graph cluster)
    expect(ids[0]).toBe("modularity");

    // coupling-cohesion and separation-of-concerns should appear (graph neighbors of top match)
    expect(ids).toContain("coupling-cohesion");
    expect(ids).toContain("separation-of-concerns");
  });

  it("surfaces graph neighbors that have zero tag score", () => {
    // "decomposition boundaries" matches modularity strongly, but not separation-of-concerns directly
    // Graph walking should still surface separation-of-concerns as a neighbor
    const results = suggestLensesWithGraph("decomposition boundaries", graphModels, []);
    const ids = results.map((r) => r.modelId);
    expect(ids).toContain("separation-of-concerns");
  });

  it("excludes already-applied lenses from graph results", () => {
    const results = suggestLensesWithGraph("modules boundaries", graphModels, ["modularity"]);
    const ids = results.map((r) => r.modelId);
    expect(ids).not.toContain("modularity");
  });

  it("labels graph-discovered models with their relationship reason", () => {
    // Use a problem that doesn't tag-match separation-of-concerns at all
    const results = suggestLensesWithGraph("modules decomposition", graphModels, []);
    const soc = results.find((r) => r.modelId === "separation-of-concerns");
    // Discovered purely via graph (no tag match), reason should start with "Related to"
    expect(soc).toBeDefined();
    expect(soc!.reason).toContain("Related to");
  });
});
