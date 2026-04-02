import { describe, it, expect } from "vitest";
import { suggestLenses, tokenize, computeClusters } from "../src/matcher.js";
import type { ModelDefinition } from "../src/types.js";

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

describe("computeClusters", () => {
  // Two clear clusters connected by a bridge model:
  // Cluster A: mod-a ↔ mod-b ↔ mod-c (tightly connected)
  // Cluster B: mod-d ↔ mod-e ↔ mod-f (tightly connected)
  // Bridge: mod-c → mod-d (one cross-cluster edge)
  // Isolated: mod-g (no connections)
  const clusterModels: ModelDefinition[] = [
    {
      id: "mod-a", name: "A", category: "cat1", categories: ["cat1"],
      tags: ["alpha"], description: "Model A",
      guiding_questions: ["?"], required_fields: { f: { description: "f", hint: "h" } },
      related_models: [{ id: "mod-b", reason: "A→B" }, { id: "mod-c", reason: "A→C" }],
      counterbalances: [],
    },
    {
      id: "mod-b", name: "B", category: "cat1", categories: ["cat1"],
      tags: ["alpha"], description: "Model B",
      guiding_questions: ["?"], required_fields: { f: { description: "f", hint: "h" } },
      related_models: [{ id: "mod-a", reason: "B→A" }, { id: "mod-c", reason: "B→C" }],
      counterbalances: [],
    },
    {
      id: "mod-c", name: "C", category: "cat1", categories: ["cat1"],
      tags: ["alpha", "bridge"], description: "Model C bridges clusters",
      guiding_questions: ["?"], required_fields: { f: { description: "f", hint: "h" } },
      related_models: [{ id: "mod-a", reason: "C→A" }, { id: "mod-b", reason: "C→B" }, { id: "mod-d", reason: "C→D" }],
      counterbalances: [],
    },
    {
      id: "mod-d", name: "D", category: "cat2", categories: ["cat2"],
      tags: ["beta"], description: "Model D",
      guiding_questions: ["?"], required_fields: { f: { description: "f", hint: "h" } },
      related_models: [{ id: "mod-e", reason: "D→E" }, { id: "mod-f", reason: "D→F" }],
      counterbalances: [],
    },
    {
      id: "mod-e", name: "E", category: "cat2", categories: ["cat2"],
      tags: ["beta"], description: "Model E",
      guiding_questions: ["?"], required_fields: { f: { description: "f", hint: "h" } },
      related_models: [{ id: "mod-d", reason: "E→D" }, { id: "mod-f", reason: "E→F" }],
      counterbalances: [],
    },
    {
      id: "mod-f", name: "F", category: "cat2", categories: ["cat2"],
      tags: ["beta"], description: "Model F",
      guiding_questions: ["?"], required_fields: { f: { description: "f", hint: "h" } },
      related_models: [{ id: "mod-d", reason: "F→D" }, { id: "mod-e", reason: "F→E" }],
      counterbalances: [{ id: "mod-a", tension: "F counters A" }],
    },
    {
      id: "mod-g", name: "G", category: "cat3", categories: ["cat3"],
      tags: ["gamma"], description: "Isolated model G",
      guiding_questions: ["?"], required_fields: { f: { description: "f", hint: "h" } },
      related_models: [],
      counterbalances: [],
    },
  ];

  it("identifies distinct clusters from the relationship graph", () => {
    const clusters = computeClusters(clusterModels);
    // Should have at least 2 clusters (the two tight groups)
    expect(clusters.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps tightly connected models in the same cluster", () => {
    const clusters = computeClusters(clusterModels);
    // mod-a, mod-b, mod-c should be in the same cluster
    const clusterWithA = clusters.find((c) => c.modelIds.includes("mod-a"));
    expect(clusterWithA).toBeDefined();
    expect(clusterWithA!.modelIds).toContain("mod-b");

    // mod-d, mod-e, mod-f should be in the same cluster
    const clusterWithD = clusters.find((c) => c.modelIds.includes("mod-d"));
    expect(clusterWithD).toBeDefined();
    expect(clusterWithD!.modelIds).toContain("mod-e");
    expect(clusterWithD!.modelIds).toContain("mod-f");
  });

  it("uses humanized category name as theme", () => {
    const clusters = computeClusters(clusterModels);
    const clusterCat1 = clusters.find((c) => c.id === "cat1");
    expect(clusterCat1!.theme).toBe("Cat1");
    const clusterCat2 = clusters.find((c) => c.id === "cat2");
    expect(clusterCat2!.theme).toBe("Cat2");
  });

  it("lists categories covered by each cluster", () => {
    const clusters = computeClusters(clusterModels);
    const clusterWithA = clusters.find((c) => c.modelIds.includes("mod-a"));
    expect(clusterWithA!.categories).toContain("cat1");
  });

  it("includes isolated models in their own cluster or a catch-all", () => {
    const clusters = computeClusters(clusterModels);
    const allModelIds = clusters.flatMap((c) => c.modelIds);
    // Every model should appear in some cluster
    expect(allModelIds).toContain("mod-g");
  });

  it("does not duplicate models across clusters", () => {
    const clusters = computeClusters(clusterModels);
    const allModelIds = clusters.flatMap((c) => c.modelIds);
    const unique = new Set(allModelIds);
    expect(unique.size).toBe(allModelIds.length);
  });
});
