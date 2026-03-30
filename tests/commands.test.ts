import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { writeWorkspace } from "../src/writer.js";
import { deriveTemplateVars } from "../src/derive-vars.js";
import { ClawstrapConfigSchema } from "../src/schema.js";
import { loadWorkspace } from "../src/load-workspace.js";
import { render } from "../src/template-engine.js";
import { templates } from "../src/templates/index.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "clawstrap-cmd-test-"));
}

function rmrf(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function initWorkspace(dir: string, overrides = {}) {
  const config = ClawstrapConfigSchema.parse({
    version: "1.0.0",
    createdAt: "2026-03-29T12:00:00.000Z",
    workspaceName: "test-ws",
    targetDirectory: ".",
    aiSystem: "claude-code",
    workloadType: "custom",
    parallelAgents: "small-team",
    qualityLevel: "team",
    sessionHandoff: true,
    ...overrides,
  });
  const vars = deriveTemplateVars(config);
  writeWorkspace(dir, vars, config);
  return { config, vars };
}

describe("load-workspace", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  it("loads workspace from directory with .clawstrap.json", () => {
    initWorkspace(tempDir);
    const ws = loadWorkspace(tempDir);
    expect(ws.config.workspaceName).toBe("test-ws");
    expect(ws.vars.systemDir).toBe(".claude");
    expect(ws.rootDir).toBe(tempDir);
  });

  it("exits if .clawstrap.json not found", () => {
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => {
        throw new Error("process.exit called");
      });

    expect(() => loadWorkspace(tempDir)).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });
});

describe("add agent (template rendering)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    initWorkspace(tempDir);
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  it("renders agent template with custom variables", () => {
    const { vars } = initWorkspace(tempDir);
    const agentVars = {
      ...vars,
      agentName: "researcher",
      agentDescription: "Researches topics and writes findings",
      agentRole: "worker",
    };

    const content = render(templates.newAgent, agentVars);
    expect(content).toContain("# Agent: researcher");
    expect(content).toContain("Researches topics and writes findings");
    expect(content).toContain("worker agent");
    expect(content).toContain("test-ws");
    expect(content).not.toMatch(/\{%\w+%\}/);
  });

  it("writes agent file to correct path", () => {
    const { vars } = initWorkspace(tempDir);
    const agentVars = {
      ...vars,
      agentName: "classifier",
      agentDescription: "Classifies items",
      agentRole: "worker",
    };

    const outPath = path.join(tempDir, ".claude", "agents", "classifier.md");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, render(templates.newAgent, agentVars), "utf-8");

    expect(fs.existsSync(outPath)).toBe(true);
    const content = fs.readFileSync(outPath, "utf-8");
    expect(content).toContain("# Agent: classifier");
  });
});

describe("add skill (template rendering)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    initWorkspace(tempDir);
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  it("renders skill template with custom variables", () => {
    const { vars } = initWorkspace(tempDir);
    const skillVars = {
      ...vars,
      skillName: "data-extraction",
      skillDescription: "Extracts structured data from documents",
      skillTriggers: "extract, parse, document",
    };

    const content = render(templates.newSkill, skillVars);
    expect(content).toContain("# Skill: data-extraction");
    expect(content).toContain("Extracts structured data from documents");
    expect(content).toContain("extract, parse, document");
    expect(content).not.toMatch(/\{%\w+%\}/);
  });

  it("updates SKILL_REGISTRY.md by replacing placeholder", () => {
    const registryPath = path.join(
      tempDir,
      ".claude",
      "skills",
      "SKILL_REGISTRY.md"
    );
    let registry = fs.readFileSync(registryPath, "utf-8");
    expect(registry).toContain("*(none yet)*");

    const newRow = `| my-skill | \`.claude/skills/my-skill/SKILL.md\` | trigger1, trigger2 |`;
    registry = registry.replace(
      /\| \*\(none yet\)\* \| — \| — \|/,
      newRow
    );

    expect(registry).toContain("my-skill");
    expect(registry).not.toContain("*(none yet)*");
  });

  it("appends second skill to existing table (not placeholder)", () => {
    const registryPath = path.join(
      tempDir,
      ".claude",
      "skills",
      "SKILL_REGISTRY.md"
    );
    let registry = fs.readFileSync(registryPath, "utf-8");

    // Simulate first skill already added (placeholder replaced)
    const firstRow = `| first-skill | \`.claude/skills/first-skill/SKILL.md\` | trigger1 |`;
    registry = registry.replace(
      /\| \*\(none yet\)\* \| — \| — \|/,
      firstRow
    );
    fs.writeFileSync(registryPath, registry, "utf-8");

    // Now simulate second skill append using the same logic as add-skill.ts
    registry = fs.readFileSync(registryPath, "utf-8");
    const secondRow = `| second-skill | \`.claude/skills/second-skill/SKILL.md\` | trigger2 |`;

    const headingIdx = registry.indexOf("## Registered Skills");
    expect(headingIdx).toBeGreaterThan(-1);
    const tableStart = registry.indexOf("|", headingIdx);
    const afterTable = registry.substring(tableStart);
    const blankLine = afterTable.search(/\n\n/);
    const insertPos =
      blankLine !== -1
        ? tableStart + blankLine + 1
        : registry.length;
    registry =
      registry.slice(0, insertPos) +
      secondRow +
      "\n" +
      registry.slice(insertPos);

    expect(registry).toContain("first-skill");
    expect(registry).toContain("second-skill");
    // Both rows should be in the Registered Skills section
    const skillsSection = registry.substring(
      registry.indexOf("## Registered Skills")
    );
    expect(skillsSection).toContain("first-skill");
    expect(skillsSection).toContain("second-skill");
  });
});

describe("add project (template rendering)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    initWorkspace(tempDir);
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  it("renders project readme with name and description", () => {
    const { vars } = initWorkspace(tempDir);
    const projectVars = {
      ...vars,
      projectName: "my-research",
      projectDescription: "Research project for testing Clawstrap.",
    };

    const content = render(templates.addProjectReadme, projectVars);
    expect(content).toContain("# Project: my-research");
    expect(content).toContain("Research project for testing Clawstrap.");
    expect(content).toContain("2026-03-29");
    expect(content).not.toMatch(/\{%\w+%\}/);
  });

  it("renders project process.md with workspace config", () => {
    const { vars } = initWorkspace(tempDir);
    const projectVars = {
      ...vars,
      projectName: "my-research",
      projectDescription: "Research project.",
    };

    const content = render(templates.addProjectProcess, projectVars);
    expect(content).toContain("# Process: my-research");
    // sessionHandoff is true, so checklists should be present
    expect(content).toContain("Session Start Checklist");
    expect(content).toContain("Session End Checklist");
    expect(content).not.toMatch(/\{%\w+%\}/);
  });

  it("renders process.md without handoff when disabled", () => {
    const config = ClawstrapConfigSchema.parse({
      version: "1.0.0",
      createdAt: "2026-03-29T12:00:00.000Z",
      workspaceName: "test-ws",
      targetDirectory: ".",
      aiSystem: "claude-code",
      workloadType: "custom",
      parallelAgents: "single",
      qualityLevel: "solo",
      sessionHandoff: false,
    });
    const vars = deriveTemplateVars(config);
    const projectVars = {
      ...vars,
      projectName: "quick-project",
      projectDescription: "A quick project.",
    };

    const content = render(templates.addProjectProcess, projectVars);
    expect(content).not.toContain("Session Start Checklist");
    expect(content).not.toContain("Session End Checklist");
  });
});

describe("status (filesystem scanning)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    initWorkspace(tempDir);
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  it("workspace has expected structure after init", () => {
    expect(
      fs.existsSync(path.join(tempDir, ".claude", "agents", "primary-agent.md"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, ".claude", "rules", "quality-gates.md"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, ".claude", "memory", "MEMORY.md"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, "projects", "_template", "README.md"))
    ).toBe(true);
  });

  it("counts agents correctly (excludes _template.md)", () => {
    const agentsDir = path.join(tempDir, ".claude", "agents");
    const entries = fs
      .readdirSync(agentsDir)
      .filter((e) => e !== "_template.md" && !e.startsWith("."));
    // primary-agent.md should be present (hasSubagents = true for small-team)
    expect(entries).toContain("primary-agent.md");
  });

  it("counts skills correctly (directories with SKILL.md)", () => {
    const skillsDir = path.join(tempDir, ".claude", "skills");
    // Create a test skill
    const testSkillDir = path.join(skillsDir, "test-skill");
    fs.mkdirSync(testSkillDir, { recursive: true });
    fs.writeFileSync(
      path.join(testSkillDir, "SKILL.md"),
      "# Test",
      "utf-8"
    );

    const count = fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter(
        (e) =>
          e.isDirectory() &&
          fs.existsSync(path.join(skillsDir, e.name, "SKILL.md"))
      ).length;
    expect(count).toBe(1);
  });
});
