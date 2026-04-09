import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

import { isDuplicate, parseMemoryEntries } from "../src/watch/dedup.js";
import { writePid, readPid, clearPid, isDaemonRunning } from "../src/watch/pid.js";
import {
  appendToMemory,
  appendToGotchaLog,
  appendToFutureConsiderations,
  appendToOpenThreads,
  writeConventions,
} from "../src/watch/writers.js";
import { runGitObserver } from "../src/watch/git.js";
import { runScan } from "../src/watch/scan.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "clawstrap-watch-test-"));
}

function rmrf(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Scaffold the minimum .claude structure that writers.ts expects */
function scaffoldWorkspace(rootDir: string): void {
  fs.mkdirSync(path.join(rootDir, ".claude", "memory"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, ".claude", "rules"), { recursive: true });
  fs.writeFileSync(path.join(rootDir, ".claude", "memory", "MEMORY.md"), "", "utf-8");
  fs.writeFileSync(path.join(rootDir, ".claude", "gotcha-log.md"), "# Gotcha Log\n\n", "utf-8");
  fs.writeFileSync(
    path.join(rootDir, ".claude", "future-considerations.md"),
    "# Future Considerations\n\n",
    "utf-8"
  );
}

// ─── dedup.ts ───────────────────────────────────────────────────────────────

describe("dedup", () => {
  describe("isDuplicate", () => {
    it("returns false for empty existing entries", () => {
      expect(isDuplicate("some new entry about caching", [])).toBe(false);
    });

    it("returns false for completely different entries", () => {
      const existing = ["We use React for the frontend UI layer"];
      expect(isDuplicate("The database is PostgreSQL with pgvector", existing)).toBe(false);
    });

    it("returns true for near-identical entries (threshold 0.75)", () => {
      const existing = ["Prefer kebab-case for all file names in this project"];
      // Same text — Jaccard = 1.0
      expect(isDuplicate("Prefer kebab-case for all file names in this project", existing)).toBe(true);
    });

    it("returns true for entry with minor rewording above threshold", () => {
      // Enough shared tokens to exceed 0.75
      const existing = ["Use kebab-case for file naming convention throughout the codebase"];
      const newEntry   = "Use kebab-case for file naming convention throughout the codebase always";
      // intersection / union will be large
      expect(isDuplicate(newEntry, existing)).toBe(true);
    });

    it("returns false for entries that share some but not enough words", () => {
      const existing = ["Use kebab-case file naming in the project"];
      // Only a couple of shared tokens
      expect(isDuplicate("Database uses PostgreSQL and Redis for caching layer", existing)).toBe(false);
    });
  });

  describe("parseMemoryEntries", () => {
    it("returns empty array for empty string", () => {
      expect(parseMemoryEntries("")).toEqual([]);
    });

    it("splits on --- delimiters correctly", () => {
      const content = [
        "---",
        "[git] 2026-01-01T00:00:00Z",
        "First entry about naming",
        "---",
        "[git] 2026-01-02T00:00:00Z",
        "Second entry about imports",
      ].join("\n");

      const entries = parseMemoryEntries(content);
      expect(entries).toHaveLength(2);
      expect(entries[0]).toContain("First entry about naming");
      expect(entries[1]).toContain("Second entry about imports");
    });

    it("ignores empty sections between delimiters", () => {
      const content = [
        "---",
        "Real entry here",
        "---",
        "   ",
        "---",
        "Another real entry",
        "---",
      ].join("\n");

      const entries = parseMemoryEntries(content);
      expect(entries).toHaveLength(2);
    });

    it("captures trailing entry after last delimiter", () => {
      const content = "---\nFirst entry\n---\nTrailing entry";
      const entries = parseMemoryEntries(content);
      expect(entries).toHaveLength(2);
      expect(entries[1]).toBe("Trailing entry");
    });
  });
});

// ─── pid.ts ─────────────────────────────────────────────────────────────────

describe("pid", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  it("writePid writes PID to file", () => {
    writePid(tempDir, 12345);
    const pidFile = path.join(tempDir, ".clawstrap.watch.pid");
    expect(fs.existsSync(pidFile)).toBe(true);
    expect(fs.readFileSync(pidFile, "utf-8").trim()).toBe("12345");
  });

  it("readPid returns null if file doesn't exist", () => {
    expect(readPid(tempDir)).toBeNull();
  });

  it("readPid returns the written PID", () => {
    writePid(tempDir, 99999);
    expect(readPid(tempDir)).toBe(99999);
  });

  it("clearPid removes the file", () => {
    writePid(tempDir, 12345);
    clearPid(tempDir);
    expect(fs.existsSync(path.join(tempDir, ".clawstrap.watch.pid"))).toBe(false);
  });

  it("clearPid is a no-op if file doesn't exist", () => {
    expect(() => clearPid(tempDir)).not.toThrow();
  });

  it("isDaemonRunning returns false if no PID file", () => {
    expect(isDaemonRunning(tempDir)).toBe(false);
  });

  it("isDaemonRunning returns true for current process PID", () => {
    writePid(tempDir, process.pid);
    expect(isDaemonRunning(tempDir)).toBe(true);
  });
});

// ─── writers.ts ─────────────────────────────────────────────────────────────

describe("writers", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    scaffoldWorkspace(tempDir);
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  const memoryPath = () => path.join(tempDir, ".claude", "memory", "MEMORY.md");

  // appendToMemory ─────────────────────────────────────────────────────────

  it("appendToMemory creates MEMORY.md section with correct source tag", () => {
    appendToMemory(tempDir, ["Use kebab-case for all file names"], "git");
    const content = fs.readFileSync(memoryPath(), "utf-8");
    expect(content).toContain("[git]");
    expect(content).toContain("Use kebab-case for all file names");
    expect(content).toContain("---");
  });

  it("appendToMemory appends (does not overwrite) on second call", () => {
    appendToMemory(tempDir, ["First entry about naming conventions"], "git");
    appendToMemory(tempDir, ["Second entry about import style rules"], "scan");
    const content = fs.readFileSync(memoryPath(), "utf-8");
    expect(content).toContain("First entry about naming conventions");
    expect(content).toContain("Second entry about import style rules");
    expect(content).toContain("[git]");
    expect(content).toContain("[scan]");
  });

  it("appendToMemory skips near-duplicate entries", () => {
    const entry = "Prefer kebab-case for all file names in this project codebase";
    appendToMemory(tempDir, [entry], "git");
    // Second call with effectively identical text
    appendToMemory(tempDir, [entry], "git");
    const content = fs.readFileSync(memoryPath(), "utf-8");
    // Should appear only once
    const count = (content.match(/Prefer kebab-case for all file names/g) ?? []).length;
    expect(count).toBe(1);
  });

  // appendToGotchaLog ──────────────────────────────────────────────────────

  it("appendToGotchaLog appends entries with timestamp", () => {
    const logPath = path.join(tempDir, ".claude", "gotcha-log.md");
    appendToGotchaLog(tempDir, ["Never skip the approval step before acting"]);
    const content = fs.readFileSync(logPath, "utf-8");
    expect(content).toContain("Never skip the approval step before acting");
    // Should include a timestamp (ISO format contains 'T')
    expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(content).toContain("[session]");
  });

  it("appendToGotchaLog creates file with header when it doesn't exist", () => {
    rmrf(tempDir);
    tempDir = makeTempDir(); // fresh dir — no scaffolding
    const logPath = path.join(tempDir, ".claude", "gotcha-log.md");
    appendToGotchaLog(tempDir, ["Test gotcha entry"]);
    const content = fs.readFileSync(logPath, "utf-8");
    expect(content).toContain("# Gotcha Log");
    expect(content).toContain("Test gotcha entry");
  });

  // appendToFutureConsiderations ───────────────────────────────────────────

  it("appendToFutureConsiderations appends entries with timestamp", () => {
    const fcPath = path.join(tempDir, ".claude", "future-considerations.md");
    appendToFutureConsiderations(tempDir, ["Consider adding streaming support"]);
    const content = fs.readFileSync(fcPath, "utf-8");
    expect(content).toContain("Consider adding streaming support");
    expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(content).toContain("[session]");
  });

  it("appendToFutureConsiderations creates file with header when it doesn't exist", () => {
    rmrf(tempDir);
    tempDir = makeTempDir(); // fresh dir — no scaffolding
    const fcPath = path.join(tempDir, ".claude", "future-considerations.md");
    appendToFutureConsiderations(tempDir, ["Test future idea"]);
    const content = fs.readFileSync(fcPath, "utf-8");
    expect(content).toContain("# Future Considerations");
    expect(content).toContain("Test future idea");
  });

  // appendToOpenThreads ────────────────────────────────────────────────────

  it("appendToOpenThreads appends entries with timestamp", () => {
    const otPath = path.join(tempDir, ".claude", "memory", "open-threads.md");
    appendToOpenThreads(tempDir, ["Revisit auth token expiry logic"]);
    const content = fs.readFileSync(otPath, "utf-8");
    expect(content).toContain("Revisit auth token expiry logic");
    expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(content).toContain("[session]");
  });

  it("appendToOpenThreads creates file with header when it doesn't exist", () => {
    rmrf(tempDir);
    tempDir = makeTempDir();
    const otPath = path.join(tempDir, ".claude", "memory", "open-threads.md");
    appendToOpenThreads(tempDir, ["Test open thread"]);
    const content = fs.readFileSync(otPath, "utf-8");
    expect(content).toContain("# Open Threads");
    expect(content).toContain("Test open thread");
  });

  // writeConventions ───────────────────────────────────────────────────────

  const sampleSections = {
    naming: ["kebab-case dominant"],
    imports: ["100% relative imports"],
    testing: ["*.test.ts pattern"],
    errorHandling: ["try/catch dominant"],
    comments: ["moderate density"],
  };

  it("writeConventions creates conventions.md from scratch when it doesn't exist", () => {
    const conventionsPath = path.join(tempDir, ".claude", "rules", "conventions.md");
    expect(fs.existsSync(conventionsPath)).toBe(false);

    writeConventions(tempDir, sampleSections);

    expect(fs.existsSync(conventionsPath)).toBe(true);
    const content = fs.readFileSync(conventionsPath, "utf-8");
    expect(content).toContain("# Conventions");
    expect(content).toContain("<!-- CLAWSTRAP:AUTO -->");
    expect(content).toContain("<!-- CLAWSTRAP:END -->");
    expect(content).toContain("kebab-case dominant");
    expect(content).toContain("*.test.ts pattern");
  });

  it("writeConventions replaces only the AUTO block when file exists with manual content", () => {
    const conventionsPath = path.join(tempDir, ".claude", "rules", "conventions.md");

    // First write to create the file
    writeConventions(tempDir, sampleSections);

    // Second write with different section data
    const updatedSections = {
      ...sampleSections,
      naming: ["PascalCase dominant (updated)"],
    };
    writeConventions(tempDir, updatedSections);

    const content = fs.readFileSync(conventionsPath, "utf-8");
    expect(content).toContain("PascalCase dominant (updated)");
    // Old naming value should be gone
    expect(content).not.toContain("kebab-case dominant");
  });

  it("writeConventions preserves content outside AUTO block", () => {
    const conventionsPath = path.join(tempDir, ".claude", "rules", "conventions.md");

    // Create a file with manual content outside the AUTO block
    const manualContent = [
      "# Conventions",
      "",
      "Some manual notes written by a human.",
      "",
      "<!-- CLAWSTRAP:AUTO -->",
      "## Naming Conventions",
      "- old naming",
      "<!-- CLAWSTRAP:END -->",
      "",
      "<!-- Add manual conventions below this line -->",
      "",
      "My custom rule: always use const over let.",
      "",
    ].join("\n");

    fs.writeFileSync(conventionsPath, manualContent, "utf-8");

    writeConventions(tempDir, sampleSections);

    const result = fs.readFileSync(conventionsPath, "utf-8");
    // Manual content before the block is preserved
    expect(result).toContain("Some manual notes written by a human.");
    // Manual content after the block is preserved
    expect(result).toContain("My custom rule: always use const over let.");
    // Old auto content is replaced
    expect(result).not.toContain("old naming");
    // New auto content is present
    expect(result).toContain("kebab-case dominant");
  });
});

// ─── git.ts ─────────────────────────────────────────────────────────────────

describe("git", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    scaffoldWorkspace(tempDir);
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  it("runGitObserver returns null if no .git directory", async () => {
    const result = await runGitObserver(tempDir, null);
    expect(result).toBeNull();
  });

  it("runGitObserver returns null if git repo has no commits", async () => {
    execSync(`git init "${tempDir}"`, { stdio: "pipe" });
    const result = await runGitObserver(tempDir, null);
    expect(result).toBeNull();
  });

  it("runGitObserver returns a result with lastCommit on a repo with commits", async () => {
    // Set up a real git repo with one commit
    execSync(`git init "${tempDir}"`, { stdio: "pipe" });
    execSync(`git -C "${tempDir}" config user.email "test@test.com"`, { stdio: "pipe" });
    execSync(`git -C "${tempDir}" config user.name "Test"`, { stdio: "pipe" });
    fs.writeFileSync(path.join(tempDir, "file.ts"), "export const hello = 'world';", "utf-8");
    execSync(`git -C "${tempDir}" add .`, { stdio: "pipe" });
    execSync(`git -C "${tempDir}" commit -m "initial commit"`, { stdio: "pipe" });

    const result = await runGitObserver(tempDir, null);
    expect(result).not.toBeNull();
    expect(typeof result!.lastCommit).toBe("string");
    expect(result!.lastCommit.length).toBeGreaterThan(0);
  });
});

// ─── scan.ts ─────────────────────────────────────────────────────────────────

describe("scan", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  it("runScan returns an object with all required section keys", async () => {
    const result = await runScan(tempDir);
    expect(result).toHaveProperty("naming");
    expect(result).toHaveProperty("imports");
    expect(result).toHaveProperty("testing");
    expect(result).toHaveProperty("errorHandling");
    expect(result).toHaveProperty("comments");
    expect(Array.isArray(result.naming)).toBe(true);
    expect(Array.isArray(result.imports)).toBe(true);
    expect(Array.isArray(result.testing)).toBe(true);
    expect(Array.isArray(result.errorHandling)).toBe(true);
    expect(Array.isArray(result.comments)).toBe(true);
  });

  it("runScan detects kebab-case naming when files are named kebab-style", async () => {
    // Create several kebab-case named files
    for (const name of [
      "my-module.ts",
      "another-file.ts",
      "kebab-helper.ts",
      "some-utility.ts",
    ]) {
      fs.writeFileSync(path.join(tempDir, name), "export const x = 1;", "utf-8");
    }

    const result = await runScan(tempDir);
    const namingText = result.naming.join(" ");
    expect(namingText).toContain("kebab-case");
  });

  it("runScan detects .test.ts test pattern when test files exist", async () => {
    fs.writeFileSync(path.join(tempDir, "my-module.ts"), "export const x = 1;", "utf-8");
    fs.writeFileSync(
      path.join(tempDir, "my-module.test.ts"),
      "import { expect } from 'vitest';",
      "utf-8"
    );

    const result = await runScan(tempDir);
    const testingText = result.testing.join(" ");
    expect(testingText).toContain("*.test.ts/js");
  });
});
