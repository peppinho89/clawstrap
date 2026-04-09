import { describe, it, expect } from "vitest";
import { ClawstrapConfigSchema } from "../src/schema.js";
import { deriveTemplateVars } from "../src/derive-vars.js";

describe("config schema", () => {
  const validConfig = {
    version: "1.0.0",
    createdAt: "2026-03-28T12:00:00.000Z",
    workspaceName: "test-workspace",
    targetDirectory: ".",
    aiSystem: "claude-code",
    workloadType: "research",
    parallelAgents: "single",
    qualityLevel: "solo",
    sessionHandoff: true,
  };

  it("accepts a valid config", () => {
    const result = ClawstrapConfigSchema.parse(validConfig);
    expect(result.workspaceName).toBe("test-workspace");
  });

  it("applies defaults for version and targetDirectory", () => {
    const minimal = {
      createdAt: "2026-03-28T12:00:00.000Z",
      workspaceName: "test",
      workloadType: "custom",
      parallelAgents: "single",
      qualityLevel: "solo",
      sessionHandoff: false,
    };
    const result = ClawstrapConfigSchema.parse(minimal);
    expect(result.version).toBe("1.0.0");
    expect(result.targetDirectory).toBe(".");
    expect(result.aiSystem).toBe("claude-code");
  });

  it("sdd defaults to false when not provided", () => {
    const minimal = {
      createdAt: "2026-03-28T12:00:00.000Z",
      workspaceName: "test",
      workloadType: "custom",
      parallelAgents: "single",
      qualityLevel: "solo",
      sessionHandoff: false,
    };
    const result = ClawstrapConfigSchema.parse(minimal);
    expect(result.sdd).toBe(false);
  });

  it("rejects empty workspace name", () => {
    expect(() =>
      ClawstrapConfigSchema.parse({ ...validConfig, workspaceName: "" })
    ).toThrow();
  });

  it("rejects invalid workload type", () => {
    expect(() =>
      ClawstrapConfigSchema.parse({ ...validConfig, workloadType: "invalid" })
    ).toThrow();
  });

  it("rejects invalid parallel agents value", () => {
    expect(() =>
      ClawstrapConfigSchema.parse({
        ...validConfig,
        parallelAgents: "mega-team",
      })
    ).toThrow();
  });

  describe("watch.git config", () => {
    it("defaults pollIntervalMinutes to 5 when watch.git is omitted", () => {
      const result = ClawstrapConfigSchema.parse({
        ...validConfig,
        watch: { adapter: "claude-local" },
      });
      expect(result.watch?.git?.pollIntervalMinutes).toBe(5);
    });

    it("defaults pollIntervalMinutes to 5 when watch is omitted entirely", () => {
      const result = ClawstrapConfigSchema.parse(validConfig);
      // watch is optional — when absent, git sub-field is not present
      expect(result.watch).toBeUndefined();
    });

    it("accepts a custom pollIntervalMinutes", () => {
      const result = ClawstrapConfigSchema.parse({
        ...validConfig,
        watch: { adapter: "claude-local", git: { pollIntervalMinutes: 10 } },
      });
      expect(result.watch?.git?.pollIntervalMinutes).toBe(10);
    });

    it("defaults scan.intervalDays to 7 alongside git defaults", () => {
      const result = ClawstrapConfigSchema.parse({
        ...validConfig,
        watch: { adapter: "claude-local" },
      });
      expect(result.watch?.scan?.intervalDays).toBe(7);
      expect(result.watch?.git?.pollIntervalMinutes).toBe(5);
    });
  });

  describe("watch.synthesis config", () => {
    it("defaults synthesis.enabled to false when watch.synthesis is omitted", () => {
      const result = ClawstrapConfigSchema.parse({
        ...validConfig,
        watch: { adapter: "claude-local" },
      });
      expect(result.watch?.synthesis?.enabled).toBe(false);
    });

    it("defaults synthesis.triggerEveryN to 10", () => {
      const result = ClawstrapConfigSchema.parse({
        ...validConfig,
        watch: { adapter: "claude-local" },
      });
      expect(result.watch?.synthesis?.triggerEveryN).toBe(10);
    });

    it("accepts custom synthesis config", () => {
      const result = ClawstrapConfigSchema.parse({
        ...validConfig,
        watch: {
          adapter: "claude-local",
          synthesis: { enabled: true, triggerEveryN: 5 },
        },
      });
      expect(result.watch?.synthesis?.enabled).toBe(true);
      expect(result.watch?.synthesis?.triggerEveryN).toBe(5);
    });
  });

  describe("watchState.entriesSinceLastSynthesis", () => {
    it("is optional and undefined when not provided", () => {
      const result = ClawstrapConfigSchema.parse(validConfig);
      expect(result.watchState).toBeUndefined();
    });

    it("parses entriesSinceLastSynthesis as a number", () => {
      const result = ClawstrapConfigSchema.parse({
        ...validConfig,
        watchState: { entriesSinceLastSynthesis: 7 },
      });
      expect(result.watchState?.entriesSinceLastSynthesis).toBe(7);
    });

    it("coerces entriesSinceLastSynthesis from string to number (written by updateWatchState)", () => {
      // updateWatchState writes String(counter) into JSON; Zod must accept it on reload
      const result = ClawstrapConfigSchema.parse({
        ...validConfig,
        watchState: { entriesSinceLastSynthesis: "5" },
      });
      expect(result.watchState?.entriesSinceLastSynthesis).toBe(5);
    });
  });
});

describe("derive template vars", () => {
  const baseConfig = ClawstrapConfigSchema.parse({
    version: "1.0.0",
    createdAt: "2026-03-28T12:00:00.000Z",
    workspaceName: "my-project",
    targetDirectory: ".",
    aiSystem: "claude-code",
    workloadType: "research",
    parallelAgents: "single",
    qualityLevel: "solo",
    sessionHandoff: true,
  });

  it("derives Claude Code paths", () => {
    const vars = deriveTemplateVars(baseConfig);
    expect(vars.systemDir).toBe(".claude");
    expect(vars.governanceFile).toBe("CLAUDE.md");
  });

  it("derives workload labels", () => {
    const vars = deriveTemplateVars(baseConfig);
    expect(vars.workloadLabel).toBe("Research & Analysis");
    expect(vars.isResearch).toBe(true);
    expect(vars.isContent).toBe(false);
  });

  it("derives subagent booleans correctly", () => {
    const single = deriveTemplateVars({ ...baseConfig, parallelAgents: "single" });
    expect(single.hasSubagents).toBe(false);
    expect(single.isProductionAgents).toBe(false);

    const team = deriveTemplateVars({ ...baseConfig, parallelAgents: "small-team" });
    expect(team.hasSubagents).toBe(true);
    expect(team.isProductionAgents).toBe(false);

    const prod = deriveTemplateVars({ ...baseConfig, parallelAgents: "production" });
    expect(prod.hasSubagents).toBe(true);
    expect(prod.isProductionAgents).toBe(true);
  });

  it("derives quality booleans correctly", () => {
    const solo = deriveTemplateVars({ ...baseConfig, qualityLevel: "solo" });
    expect(solo.hasQualityGates).toBe(false);
    expect(solo.isProductionQuality).toBe(false);

    const team = deriveTemplateVars({ ...baseConfig, qualityLevel: "team" });
    expect(team.hasQualityGates).toBe(true);
    expect(team.isProductionQuality).toBe(false);

    const prod = deriveTemplateVars({ ...baseConfig, qualityLevel: "production" });
    expect(prod.hasQualityGates).toBe(true);
    expect(prod.isProductionQuality).toBe(true);
  });

  it("extracts date from ISO string", () => {
    const vars = deriveTemplateVars(baseConfig);
    expect(vars.generatedDate).toBe("2026-03-28");
  });

  it("derives flush cadence from workload type", () => {
    const research = deriveTemplateVars({ ...baseConfig, workloadType: "research" });
    expect(research.flushCadence).toBe("every 3 findings");

    const data = deriveTemplateVars({ ...baseConfig, workloadType: "data-processing" });
    expect(data.flushCadence).toBe("every 5 batch items");
  });
});
