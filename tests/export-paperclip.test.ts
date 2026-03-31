import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { writeWorkspace } from "../src/writer.js";
import { deriveTemplateVars } from "../src/derive-vars.js";
import { ClawstrapConfigSchema } from "../src/schema.js";
import { translateAgents } from "../src/export-paperclip/translate-agents.js";
import {
  getGovernanceConfig,
  buildGovernanceDoc,
} from "../src/export-paperclip/translate-governance.js";
import { translateSkills } from "../src/export-paperclip/translate-skills.js";
import { translateGoals } from "../src/export-paperclip/translate-goals.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "clawstrap-export-test-"));
}

function rmrf(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function initWorkspace(dir: string, overrides = {}) {
  const config = ClawstrapConfigSchema.parse({
    version: "1.2.0",
    createdAt: "2026-03-30T12:00:00.000Z",
    workspaceName: "test-ws",
    targetDirectory: ".",
    aiSystem: "claude-code",
    workloadType: "research",
    parallelAgents: "small-team",
    qualityLevel: "team",
    sessionHandoff: true,
    ...overrides,
  });
  const vars = deriveTemplateVars(config);
  writeWorkspace(dir, vars, config);
  return { config, vars };
}

describe("translate-agents", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    initWorkspace(tempDir);
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  it("translates primary-agent.md to CEO with agentcompanies fields", () => {
    const agents = translateAgents(tempDir, ".claude", "test-ws", []);
    const ceo = agents.find((a) => a.slug === "ceo");
    expect(ceo).toBeDefined();
    expect(ceo!.name).toBe("CEO");
    expect(ceo!.title).toBe("Chief Executive Officer");
    expect(ceo!.reportsTo).toBeNull();
    expect(ceo!.skills).toEqual([]);
  });

  it("generates CEO for single-agent workspace", () => {
    const singleDir = makeTempDir();
    initWorkspace(singleDir, { parallelAgents: "single" });
    const agents = translateAgents(singleDir, ".claude", "test-ws", []);
    expect(agents).toHaveLength(1);
    expect(agents[0].slug).toBe("ceo");
    expect(agents[0].name).toBe("CEO");
    expect(agents[0].body).toContain("CEO of test-ws");
    rmrf(singleDir);
  });

  it("translates custom agents as workers reporting to CEO", () => {
    const agentDir = path.join(tempDir, ".claude", "agents");
    fs.writeFileSync(
      path.join(agentDir, "researcher.md"),
      "# Agent: researcher\n> **Purpose**: Research topics\n\nDoes research.",
      "utf-8"
    );

    const agents = translateAgents(tempDir, ".claude", "test-ws", []);
    const researcher = agents.find((a) => a.slug === "researcher");
    expect(researcher).toBeDefined();
    expect(researcher!.reportsTo).toBe("ceo");
    expect(researcher!.title).toBe("Research topics");
  });

  it("generates agents with Paperclip-style body sections", () => {
    const agentDir = path.join(tempDir, ".claude", "agents");
    fs.writeFileSync(
      path.join(agentDir, "qa-bot.md"),
      "# Agent: qa-bot\n> **Purpose**: Reviews code quality\n\nReviews things.",
      "utf-8"
    );

    const agents = translateAgents(tempDir, ".claude", "test-ws", ["code-review"]);
    const ceo = agents.find((a) => a.slug === "ceo")!;
    const qa = agents.find((a) => a.slug === "qa-bot")!;

    // CEO should have the gstack-style sections
    expect(ceo.body).toContain("## What triggers you");
    expect(ceo.body).toContain("## What you do");
    expect(ceo.body).toContain("## What you produce");
    expect(ceo.body).toContain("## Who you hand off to");
    // CEO should reference team members
    expect(ceo.body).toContain("Qa Bot");

    // QA agent detected as reviewer should have reviewer-style body
    expect(qa.body).toContain("## What triggers you");
    expect(qa.body).toContain("quality gate mode");
    expect(qa.skills).toEqual(["code-review"]);
  });

  it("excludes _template.md from translation", () => {
    const agents = translateAgents(tempDir, ".claude", "test-ws", []);
    const template = agents.find((a) => a.slug === "_template");
    expect(template).toBeUndefined();
  });
});

describe("translate-governance", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    initWorkspace(tempDir);
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  it("maps solo to light tier", () => {
    const config = getGovernanceConfig("solo");
    expect(config.tier).toBe("light");
    expect(config.requiresApproval).toBe(false);
  });

  it("maps team to standard tier", () => {
    const config = getGovernanceConfig("team");
    expect(config.tier).toBe("standard");
    expect(config.requiresApproval).toBe(true);
    expect(config.approvalGates).toContain("strategy");
  });

  it("maps production to strict tier", () => {
    const config = getGovernanceConfig("production");
    expect(config.tier).toBe("strict");
    expect(config.approvalGates).toContain("task-transition");
  });

  it("builds governance doc from workspace rules", () => {
    const doc = buildGovernanceDoc(tempDir, ".claude", "team");
    expect(doc).toContain("# Governance Rules");
    expect(doc).toContain("Tier: standard");
    expect(doc).toContain("## Approval Gates");
  });
});

describe("translate-skills", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    initWorkspace(tempDir);
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  it("returns empty array when no skills exist", () => {
    const skills = translateSkills(tempDir, ".claude");
    expect(skills).toHaveLength(0);
  });

  it("finds skills with SKILL.md", () => {
    const skillDir = path.join(tempDir, ".claude", "skills", "research");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "# Research Skill\nDoes research.",
      "utf-8"
    );

    const skills = translateSkills(tempDir, ".claude");
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("research");
    expect(skills[0].content).toContain("Research Skill");
  });
});

describe("translate-goals", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    initWorkspace(tempDir);
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  it("returns empty array when no projects exist", () => {
    const goals = translateGoals(tempDir);
    expect(goals).toHaveLength(0);
  });

  it("excludes _template from goals", () => {
    const goals = translateGoals(tempDir);
    const template = goals.find((g) => g.name === "_template");
    expect(template).toBeUndefined();
  });

  it("extracts description from project README", () => {
    const projectDir = path.join(tempDir, "projects", "my-research");
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "README.md"),
      "# Project: my-research\n\n---\n\n## What This Project Is\n\nA research project about AI governance.\n\n---\n",
      "utf-8"
    );

    const goals = translateGoals(tempDir);
    expect(goals).toHaveLength(1);
    expect(goals[0].name).toBe("my-research");
    expect(goals[0].description).toBe(
      "A research project about AI governance."
    );
  });
});
