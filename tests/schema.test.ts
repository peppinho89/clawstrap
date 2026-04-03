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
