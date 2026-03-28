import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { writeWorkspace } from "../src/writer.js";
import { deriveTemplateVars } from "../src/derive-vars.js";
import { ClawstrapConfigSchema } from "../src/schema.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "clawstrap-test-"));
}

function rmrf(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("writer", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  function makeConfig(overrides = {}) {
    return ClawstrapConfigSchema.parse({
      version: "1.0.0",
      createdAt: "2026-03-28T12:00:00.000Z",
      workspaceName: "test-ws",
      targetDirectory: ".",
      aiSystem: "claude-code",
      workloadType: "custom",
      parallelAgents: "single",
      qualityLevel: "solo",
      sessionHandoff: false,
      ...overrides,
    });
  }

  it("writes minimal workspace (solo, single, no handoff)", () => {
    const config = makeConfig();
    const vars = deriveTemplateVars(config);
    const result = writeWorkspace(tempDir, vars, config);

    // Always-generated files should exist
    expect(fs.existsSync(path.join(tempDir, "CLAUDE.md"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "GETTING_STARTED.md"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, ".gitignore"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, ".clawstrap.json"))).toBe(true);
    expect(
      fs.existsSync(
        path.join(tempDir, ".claude/rules/context-discipline.md")
      )
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, ".claude/rules/approval-first.md"))
    ).toBe(true);

    // Conditional files should NOT exist
    expect(
      fs.existsSync(path.join(tempDir, ".claude/rules/quality-gates.md"))
    ).toBe(false);
    expect(
      fs.existsSync(path.join(tempDir, ".claude/agents/primary-agent.md"))
    ).toBe(false);
    expect(
      fs.existsSync(path.join(tempDir, ".claude/memory/MEMORY.md"))
    ).toBe(false);

    // Empty dirs should exist
    expect(fs.existsSync(path.join(tempDir, "tmp/.gitignore"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "research/.gitkeep"))).toBe(true);

    expect(result.filesWritten.length).toBeGreaterThan(0);
  });

  it("writes maximal workspace (production, production, handoff)", () => {
    const config = makeConfig({
      workloadType: "data-processing",
      parallelAgents: "production",
      qualityLevel: "production",
      sessionHandoff: true,
    });
    const vars = deriveTemplateVars(config);
    const result = writeWorkspace(tempDir, vars, config);

    // All conditional files should exist
    expect(
      fs.existsSync(path.join(tempDir, ".claude/rules/quality-gates.md"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, ".claude/agents/primary-agent.md"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, ".claude/agents/_template.md"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, ".claude/subagent-bootstrap.md"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, ".claude/memory/MEMORY.md"))
    ).toBe(true);

    expect(result.filesWritten.length).toBeGreaterThan(10);
  });

  it("writes .clawstrap.json with correct content", () => {
    const config = makeConfig();
    const vars = deriveTemplateVars(config);
    writeWorkspace(tempDir, vars, config);

    const written = JSON.parse(
      fs.readFileSync(path.join(tempDir, ".clawstrap.json"), "utf-8")
    );
    expect(written.workspaceName).toBe("test-ws");
    expect(written.aiSystem).toBe("claude-code");
    expect(written.version).toBe("1.0.0");
  });

  it("generates valid content (no unresolved template variables)", () => {
    const config = makeConfig({
      parallelAgents: "production",
      qualityLevel: "production",
      sessionHandoff: true,
    });
    const vars = deriveTemplateVars(config);
    writeWorkspace(tempDir, vars, config);

    // Read every generated file and check for unresolved {%...%} markers
    function checkDir(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (entry.name.endsWith(".md") || entry.name === ".gitignore") {
          const content = fs.readFileSync(fullPath, "utf-8");
          const unresolved = content.match(/\{%\w+%\}/g);
          if (unresolved) {
            throw new Error(
              `Unresolved variables in ${fullPath}: ${unresolved.join(", ")}`
            );
          }
        }
      }
    }

    checkDir(tempDir);
  });

  it("tmp directory has special .gitignore", () => {
    const config = makeConfig();
    const vars = deriveTemplateVars(config);
    writeWorkspace(tempDir, vars, config);

    const gitignore = fs.readFileSync(
      path.join(tempDir, "tmp/.gitignore"),
      "utf-8"
    );
    expect(gitignore).toContain("*");
    expect(gitignore).toContain("!.gitignore");
  });
});
