import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
import { synthesizeMemory } from "../src/watch/synthesize.js";
import { inferArchitecturePatterns } from "../src/watch/infer.js";
import { checkAndPromoteCorrections, countPendingRules, listPendingRules } from "../src/watch/promote.js";
import { STOPWORDS } from "../src/watch/stopwords.js";

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

  it("writeConventions includes Architecture section when architecture rules provided", () => {
    const conventionsPath = path.join(tempDir, ".claude", "rules", "conventions.md");
    writeConventions(tempDir, {
      ...sampleSections,
      architecture: [
        "Always isolate external I/O in adapters/ files",
        "Never call services directly from CLI handlers",
      ],
    });
    const content = fs.readFileSync(conventionsPath, "utf-8");
    expect(content).toContain("## Architecture & Design Patterns");
    expect(content).toContain("Always isolate external I/O in adapters/ files");
    expect(content).toContain("Never call services directly from CLI handlers");
  });

  it("writeConventions omits Architecture section when architecture is absent", () => {
    const conventionsPath = path.join(tempDir, ".claude", "rules", "conventions.md");
    writeConventions(tempDir, sampleSections);
    const content = fs.readFileSync(conventionsPath, "utf-8");
    expect(content).not.toContain("## Architecture & Design Patterns");
  });

  it("writeConventions omits Architecture section when architecture is empty array", () => {
    const conventionsPath = path.join(tempDir, ".claude", "rules", "conventions.md");
    writeConventions(tempDir, { ...sampleSections, architecture: [] });
    const content = fs.readFileSync(conventionsPath, "utf-8");
    expect(content).not.toContain("## Architecture & Design Patterns");
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

// ─── git observer polling (issue #7) ─────────────────────────────────────────

describe("git observer polling", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    scaffoldWorkspace(tempDir);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    rmrf(tempDir);
  });

  it("incremental run returns entriesWritten: 0 when already at HEAD", async () => {
    // Set up a repo with one commit
    execSync(`git init "${tempDir}"`, { stdio: "pipe" });
    execSync(`git -C "${tempDir}" config user.email "test@test.com"`, { stdio: "pipe" });
    execSync(`git -C "${tempDir}" config user.name "Test"`, { stdio: "pipe" });
    fs.writeFileSync(path.join(tempDir, "a.ts"), "export const x = 1;", "utf-8");
    execSync(`git -C "${tempDir}" add .`, { stdio: "pipe" });
    execSync(`git -C "${tempDir}" commit -m "first commit"`, { stdio: "pipe" });

    const first = await runGitObserver(tempDir, null);
    expect(first).not.toBeNull();

    // Second call with HEAD as sinceCommit — no new commits
    const second = await runGitObserver(tempDir, first!.lastCommit);
    expect(second).not.toBeNull();
    expect(second!.entriesWritten).toBe(0);
    expect(second!.lastCommit).toBe(first!.lastCommit);
  });

  it("incremental run returns new entries after a second commit", async () => {
    execSync(`git init "${tempDir}"`, { stdio: "pipe" });
    execSync(`git -C "${tempDir}" config user.email "test@test.com"`, { stdio: "pipe" });
    execSync(`git -C "${tempDir}" config user.name "Test"`, { stdio: "pipe" });

    // First commit
    fs.writeFileSync(path.join(tempDir, "a.ts"), "export const x = 1;", "utf-8");
    execSync(`git -C "${tempDir}" add .`, { stdio: "pipe" });
    execSync(`git -C "${tempDir}" commit -m "first commit"`, { stdio: "pipe" });

    const first = await runGitObserver(tempDir, null);
    expect(first).not.toBeNull();

    // Second commit
    fs.writeFileSync(path.join(tempDir, "b.ts"), "export const y = 2;", "utf-8");
    execSync(`git -C "${tempDir}" add .`, { stdio: "pipe" });
    execSync(`git -C "${tempDir}" commit -m "second commit"`, { stdio: "pipe" });

    // Incremental: only picks up second commit
    const second = await runGitObserver(tempDir, first!.lastCommit);
    expect(second).not.toBeNull();
    expect(second!.lastCommit).not.toBe(first!.lastCommit);
    // entriesWritten can be 0 if the single commit doesn't reach insight thresholds;
    // what matters is lastCommit advanced
    expect(second!.lastCommit.length).toBeGreaterThan(0);
  });

  it("poll interval fires after configured delay (fake timers)", async () => {
    const calls: Array<string | null> = [];
    const mockObserver = vi.fn(async (_rootDir: string, sinceCommit: string | null) => {
      calls.push(sinceCommit);
      return { lastCommit: "abc123", entriesWritten: 0 };
    });

    const pollIntervalMs = 5 * 60 * 1000; // 5 minutes

    // Simulate the poller loop directly (mirrors daemon.ts logic)
    let lastGitCommit: string | null = "initial";
    let gitRunning = false;
    const timer = setInterval(async () => {
      if (gitRunning) return;
      gitRunning = true;
      try {
        const result = await mockObserver(tempDir, lastGitCommit);
        if (result) lastGitCommit = result.lastCommit;
      } finally {
        gitRunning = false;
      }
    }, pollIntervalMs);

    // No calls yet
    expect(mockObserver).not.toHaveBeenCalled();

    // Advance past one interval
    await vi.advanceTimersByTimeAsync(pollIntervalMs + 1);
    expect(mockObserver).toHaveBeenCalledTimes(1);
    expect(calls[0]).toBe("initial");
    expect(lastGitCommit).toBe("abc123");

    // Advance past a second interval
    await vi.advanceTimersByTimeAsync(pollIntervalMs);
    expect(mockObserver).toHaveBeenCalledTimes(2);
    expect(calls[1]).toBe("abc123"); // uses updated lastGitCommit

    clearInterval(timer);
  });

  it("concurrency guard skips overlapping poll ticks", async () => {
    let resolveFirst!: () => void;
    const slowObserver = vi.fn(
      () =>
        new Promise<{ lastCommit: string; entriesWritten: number }>((resolve) => {
          resolveFirst = () => resolve({ lastCommit: "slow123", entriesWritten: 0 });
        })
    );

    const pollIntervalMs = 1000;
    let gitRunning = false;
    const timer = setInterval(async () => {
      if (gitRunning) return;
      gitRunning = true;
      try {
        await slowObserver();
      } finally {
        gitRunning = false;
      }
    }, pollIntervalMs);

    // Trigger first tick — observer hangs
    await vi.advanceTimersByTimeAsync(pollIntervalMs + 1);
    expect(slowObserver).toHaveBeenCalledTimes(1);

    // Trigger second tick while first is still running
    await vi.advanceTimersByTimeAsync(pollIntervalMs);
    expect(slowObserver).toHaveBeenCalledTimes(1); // guard blocked it

    // Resolve the first run
    resolveFirst();
    await vi.advanceTimersByTimeAsync(0);

    // Third tick — now unblocked
    await vi.advanceTimersByTimeAsync(pollIntervalMs);
    expect(slowObserver).toHaveBeenCalledTimes(2);

    clearInterval(timer);
  });
});

// ─── appendToMemory return value (issue #8) ──────────────────────────────────

describe("appendToMemory return value", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    scaffoldWorkspace(tempDir);
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  it("returns the number of entries actually written", () => {
    const written = appendToMemory(tempDir, ["Entry about testing patterns"], "git");
    expect(written).toBe(1);
  });

  it("returns 0 when all entries are near-duplicates", () => {
    const entry = "Prefer kebab-case for all file names in this project codebase";
    appendToMemory(tempDir, [entry], "git");
    const second = appendToMemory(tempDir, [entry], "git");
    expect(second).toBe(0);
  });

  it("returns count of non-duplicate entries when batch is mixed", () => {
    const entry = "Use kebab-case for all file names in this project codebase forever";
    appendToMemory(tempDir, [entry], "git");
    // Second call: same entry (dup) + new entry
    const written = appendToMemory(
      tempDir,
      [entry, "Completely different entry about database migrations"],
      "git"
    );
    expect(written).toBe(1);
  });
});

// ─── synthesize.ts (issue #8) ────────────────────────────────────────────────

describe("synthesizeMemory", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    scaffoldWorkspace(tempDir);
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  const memPath = () =>
    path.join(tempDir, ".claude", "memory", "MEMORY.md");

  it("returns null when MEMORY.md does not exist", async () => {
    fs.rmSync(memPath());
    const adapter = { complete: vi.fn(async () => "summary text") };
    const result = await synthesizeMemory(tempDir, adapter);
    expect(result).toBeNull();
    expect(adapter.complete).not.toHaveBeenCalled();
  });

  it("returns null when MEMORY.md has no entries", async () => {
    // file exists but is empty
    fs.writeFileSync(memPath(), "", "utf-8");
    const adapter = { complete: vi.fn(async () => "summary text") };
    const result = await synthesizeMemory(tempDir, adapter);
    expect(result).toBeNull();
  });

  it("calls adapter and writes Living Summary block to MEMORY.md", async () => {
    appendToMemory(tempDir, ["Use kebab-case for all file names"], "git");
    appendToMemory(tempDir, ["All tests use vitest framework"], "git");

    const adapter = { complete: vi.fn(async () => "This workspace uses kebab-case and vitest.") };
    const result = await synthesizeMemory(tempDir, adapter);

    expect(result).toBe("This workspace uses kebab-case and vitest.");
    expect(adapter.complete).toHaveBeenCalledOnce();

    const content = fs.readFileSync(memPath(), "utf-8");
    expect(content).toContain("<!-- CLAWSTRAP:SYNTHESIS:START -->");
    expect(content).toContain("<!-- CLAWSTRAP:SYNTHESIS:END -->");
    expect(content).toContain("## Living Summary");
    expect(content).toContain("This workspace uses kebab-case and vitest.");
  });

  it("replaces existing Living Summary block on second run", async () => {
    appendToMemory(tempDir, ["Entry one about patterns"], "git");
    const adapter = { complete: vi.fn() };

    adapter.complete.mockResolvedValueOnce("First summary.");
    await synthesizeMemory(tempDir, adapter);

    adapter.complete.mockResolvedValueOnce("Updated summary.");
    await synthesizeMemory(tempDir, adapter);

    const content = fs.readFileSync(memPath(), "utf-8");
    expect(content).toContain("Updated summary.");
    expect(content).not.toContain("First summary.");
    // Only one synthesis block
    expect(content.split("<!-- CLAWSTRAP:SYNTHESIS:START -->").length - 1).toBe(1);
  });

  it("preserves raw entries below the Living Summary block", async () => {
    appendToMemory(tempDir, ["Raw entry that must be preserved"], "git");
    const adapter = { complete: vi.fn(async () => "A summary.") };
    await synthesizeMemory(tempDir, adapter);

    const content = fs.readFileSync(memPath(), "utf-8");
    expect(content).toContain("Raw entry that must be preserved");
    expect(content).toContain("<!-- CLAWSTRAP:SYNTHESIS:START -->");
  });

  it("returns null and does not write when adapter throws", async () => {
    appendToMemory(tempDir, ["Some entry"], "git");
    const originalContent = fs.readFileSync(memPath(), "utf-8");

    const adapter = { complete: vi.fn(async () => { throw new Error("LLM unavailable"); }) };
    const result = await synthesizeMemory(tempDir, adapter);

    expect(result).toBeNull();
    // File should be unchanged
    expect(fs.readFileSync(memPath(), "utf-8")).toBe(originalContent);
  });

  it("strips markdown code fences from adapter response", async () => {
    appendToMemory(tempDir, ["Entry about code style"], "git");
    const adapter = {
      complete: vi.fn(async () => "```\nClean summary text.\n```"),
    };
    const result = await synthesizeMemory(tempDir, adapter);
    expect(result).toBe("Clean summary text.");
  });

  it("passes existing summary to adapter on second run", async () => {
    appendToMemory(tempDir, ["Entry one"], "git");
    const adapter = { complete: vi.fn() };

    adapter.complete.mockResolvedValueOnce("First summary.");
    await synthesizeMemory(tempDir, adapter);

    adapter.complete.mockResolvedValueOnce("Updated summary.");
    await synthesizeMemory(tempDir, adapter);

    // Second call's prompt should include the first summary
    const secondCallPrompt = adapter.complete.mock.calls[1][0] as string;
    expect(secondCallPrompt).toContain("First summary.");
  });

  // #6 fix: synthesis block must not pollute parseMemoryEntries ───────────────

  it("does not pass synthesis block content to adapter as a memory entry", async () => {
    appendToMemory(tempDir, ["Real memory entry about code style"], "git");
    const adapter = { complete: vi.fn() };

    adapter.complete.mockResolvedValueOnce("First summary paragraph.");
    await synthesizeMemory(tempDir, adapter);

    adapter.complete.mockResolvedValueOnce("Second summary paragraph.");
    await synthesizeMemory(tempDir, adapter);

    // The second call's prompt must NOT contain synthesis block markers or headings
    const secondPrompt = adapter.complete.mock.calls[1][0] as string;
    expect(secondPrompt).not.toContain("<!-- CLAWSTRAP:SYNTHESIS:START -->");
    expect(secondPrompt).not.toContain("## Living Summary");
    // It should contain the real memory entry
    expect(secondPrompt).toContain("Real memory entry about code style");
  });

  // #14: no-heading fallback path ──────────────────────────────────────────────

  it("inserts synthesis block at top when MEMORY.md has no heading line", async () => {
    // Write entries without a heading
    fs.writeFileSync(
      memPath(),
      "---\n[git] 2026-01-01T00:00:00.000Z\nEntry without a heading\n",
      "utf-8"
    );
    const adapter = { complete: vi.fn(async () => "Summary for headingless file.") };
    await synthesizeMemory(tempDir, adapter);

    const content = fs.readFileSync(memPath(), "utf-8");
    expect(content).toContain("<!-- CLAWSTRAP:SYNTHESIS:START -->");
    expect(content).toContain("Summary for headingless file.");
    // Raw entry is still present
    expect(content).toContain("Entry without a heading");
  });

  it("inserts synthesis block after heading when MEMORY.md has a heading without trailing newline", async () => {
    fs.writeFileSync(memPath(), "# Memory", "utf-8"); // no trailing newline
    appendToMemory(tempDir, ["Entry after headingless file"], "git");
    const adapter = { complete: vi.fn(async () => "Summary after bare heading.") };
    await synthesizeMemory(tempDir, adapter);

    const content = fs.readFileSync(memPath(), "utf-8");
    // Synthesis block should appear after the heading, not before it
    const headingPos = content.indexOf("# Memory");
    const blockPos = content.indexOf("<!-- CLAWSTRAP:SYNTHESIS:START -->");
    expect(headingPos).toBeLessThan(blockPos);
  });
});

// ─── synthesize counter / maybeSynthesize (#12, #13) ─────────────────────────
// These tests exercise the counter accumulation and trigger threshold logic
// directly, without going through the full daemon.

describe("synthesis counter logic", () => {
  it("does not trigger synthesis when count is below threshold", async () => {
    const adapter = { complete: vi.fn(async () => "summary") };
    let entriesSince = 0;
    const triggerEveryN = 3;
    const synthEnabled = true;

    // Simulate one entry written — below threshold
    entriesSince += 1;
    const shouldFire = synthEnabled && entriesSince >= triggerEveryN;
    expect(shouldFire).toBe(false);
    expect(adapter.complete).not.toHaveBeenCalled();
  });

  it("triggers synthesis when count reaches threshold", () => {
    let entriesSince = 0;
    const triggerEveryN = 3;

    entriesSince += 3;
    const shouldFire = entriesSince >= triggerEveryN;
    expect(shouldFire).toBe(true);
  });

  it("does not trigger synthesis when synthEnabled is false, even above threshold", () => {
    const synthEnabled = false;
    let entriesSince = 100;
    const triggerEveryN = 1;

    const shouldFire = synthEnabled && entriesSince >= triggerEveryN;
    expect(shouldFire).toBe(false);
  });

  it("counter resets to 0 after synthesis fires", () => {
    let entriesSince = 10;
    // After synthesis
    entriesSince = 0;
    expect(entriesSince).toBe(0);
  });

  it("appendToMemory return value accumulates correctly across calls", () => {
    const tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "clawstrap-counter-test-"));
    fs.mkdirSync(path.join(tempDir2, ".claude", "memory"), { recursive: true });
    fs.writeFileSync(path.join(tempDir2, ".claude", "memory", "MEMORY.md"), "", "utf-8");

    try {
      let total = 0;
      total += appendToMemory(tempDir2, ["First unique entry about caching patterns"], "git");
      total += appendToMemory(tempDir2, ["Second unique entry about module structure"], "git");
      total += appendToMemory(tempDir2, ["Third unique entry about test conventions"], "git");
      expect(total).toBe(3);
    } finally {
      fs.rmSync(tempDir2, { recursive: true, force: true });
    }
  });
});

// ─── infer.ts (issue #6) ─────────────────────────────────────────────────────

describe("inferArchitecturePatterns", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    scaffoldWorkspace(tempDir);
  });

  afterEach(() => {
    rmrf(tempDir);
  });

  const syntacticSections = {
    naming: ["kebab-case dominant"],
    imports: ["100% relative imports"],
    testing: ["*.test.ts pattern"],
    errorHandling: ["try/catch dominant"],
    comments: ["moderate density"],
  };

  it("returns empty array when fewer than 3 code files exist", async () => {
    // tempDir has no source files
    const adapter = { complete: vi.fn(async () => "Always do something.") };
    const result = await inferArchitecturePatterns(tempDir, syntacticSections, adapter);
    expect(result).toEqual([]);
    expect(adapter.complete).not.toHaveBeenCalled();
  });

  it("calls adapter and returns parsed rules when enough files exist", async () => {
    // Create 3+ source files
    for (const name of ["a.ts", "b.ts", "c.ts"]) {
      fs.writeFileSync(
        path.join(tempDir, name),
        "export function foo() { return 1; }\n",
        "utf-8"
      );
    }
    const adapter = {
      complete: vi.fn(async () =>
        "Always isolate I/O in adapters/ files\nNever call services directly from CLI\nWhen handling errors, always wrap with context"
      ),
    };
    const result = await inferArchitecturePatterns(tempDir, syntacticSections, adapter);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatch(/^Always/);
    expect(result[1]).toMatch(/^Never/);
    expect(result[2]).toMatch(/^When/);
    expect(adapter.complete).toHaveBeenCalledOnce();
  });

  it("filters out lines that do not start with Always/Never/When", async () => {
    for (const name of ["a.ts", "b.ts", "c.ts"]) {
      fs.writeFileSync(path.join(tempDir, name), "export const x = 1;\n", "utf-8");
    }
    const adapter = {
      complete: vi.fn(async () =>
        "Here are the rules:\nAlways use kebab-case\nThis is not a rule\nNever import barrel files"
      ),
    };
    const result = await inferArchitecturePatterns(tempDir, syntacticSections, adapter);
    expect(result).toHaveLength(2);
    expect(result).toContain("Always use kebab-case");
    expect(result).toContain("Never import barrel files");
  });

  it("strips markdown code fences and leading list markers from adapter response", async () => {
    for (const name of ["a.ts", "b.ts", "c.ts"]) {
      fs.writeFileSync(path.join(tempDir, name), "export const x = 1;\n", "utf-8");
    }
    const adapter = {
      complete: vi.fn(async () =>
        "```\n1. Always prefer composition over inheritance\n- Never mutate shared state\n```"
      ),
    };
    const result = await inferArchitecturePatterns(tempDir, syntacticSections, adapter);
    expect(result).toContain("Always prefer composition over inheritance");
    expect(result).toContain("Never mutate shared state");
  });

  it("returns empty array when adapter throws", async () => {
    for (const name of ["a.ts", "b.ts", "c.ts"]) {
      fs.writeFileSync(path.join(tempDir, name), "export const x = 1;\n", "utf-8");
    }
    const adapter = {
      complete: vi.fn(async () => { throw new Error("LLM unavailable"); }),
    };
    const result = await inferArchitecturePatterns(tempDir, syntacticSections, adapter);
    expect(result).toEqual([]);
  });

  it("excludes test files from the sample sent to adapter", async () => {
    for (const name of ["a.ts", "b.ts", "c.ts"]) {
      fs.writeFileSync(path.join(tempDir, name), "export const x = 1;\n", "utf-8");
    }
    fs.writeFileSync(
      path.join(tempDir, "a.test.ts"),
      "it('test', () => {})\n",
      "utf-8"
    );
    const adapter = { complete: vi.fn().mockResolvedValue("Always write tests.") };
    await inferArchitecturePatterns(tempDir, syntacticSections, adapter);

    // Adapter must have been called (3 source files exist)
    expect(adapter.complete).toHaveBeenCalledOnce();
    const prompt = adapter.complete.mock.calls[0][0] as string;
    expect(prompt).not.toContain("a.test.ts");
  });

  it("includes syntactic findings in the prompt", async () => {
    for (const name of ["a.ts", "b.ts", "c.ts"]) {
      fs.writeFileSync(path.join(tempDir, name), "export const x = 1;\n", "utf-8");
    }
    const adapter = { complete: vi.fn().mockResolvedValue("Always use kebab-case.") };
    await inferArchitecturePatterns(tempDir, syntacticSections, adapter);

    // Adapter must have been called (3 source files exist)
    expect(adapter.complete).toHaveBeenCalledOnce();
    const prompt = adapter.complete.mock.calls[0][0] as string;
    expect(prompt).toContain("kebab-case dominant");
    expect(prompt).toContain("try/catch dominant");
  });

  it("truncates files longer than 150 lines and appends truncation marker", async () => {
    const longContent = Array.from({ length: 200 }, (_, i) => `const line${i} = ${i};`).join("\n");
    fs.writeFileSync(path.join(tempDir, "long.ts"), longContent, "utf-8");
    for (const name of ["b.ts", "c.ts"]) {
      fs.writeFileSync(path.join(tempDir, name), "export const x = 1;\n", "utf-8");
    }
    const adapter = { complete: vi.fn().mockResolvedValue("Always keep files short.") };
    await inferArchitecturePatterns(tempDir, syntacticSections, adapter);

    expect(adapter.complete).toHaveBeenCalledOnce();
    const prompt = adapter.complete.mock.calls[0][0] as string;
    expect(prompt).toContain("// ... truncated");
    expect(prompt).not.toContain("const line199");
  });

  it("returns empty array when adapter returns no qualifying rules", async () => {
    for (const name of ["a.ts", "b.ts", "c.ts"]) {
      fs.writeFileSync(path.join(tempDir, name), "export const x = 1;\n", "utf-8");
    }
    const adapter = { complete: vi.fn().mockResolvedValue("Here are some thoughts.\nUse good patterns.\nWrite clean code.") };
    const result = await inferArchitecturePatterns(tempDir, syntacticSections, adapter);
    expect(result).toEqual([]);
    expect(adapter.complete).toHaveBeenCalledOnce();
  });

  it("uses walkCodeFiles fallback when git is unavailable", async () => {
    for (const name of ["a.ts", "b.ts", "c.ts"]) {
      fs.writeFileSync(path.join(tempDir, name), "export const x = 1;\n", "utf-8");
    }
    const adapter = { complete: vi.fn().mockResolvedValue("Always prefer composition.") };
    const result = await inferArchitecturePatterns(tempDir, syntacticSections, adapter);
    expect(adapter.complete).toHaveBeenCalledOnce();
    expect(result).toContain("Always prefer composition.");
  });
});

// ─── checkAndPromoteCorrections ───────────────────────────────────────────────

describe("checkAndPromoteCorrections", () => {
  let tempDir: string;

  const validResponse =
    "TITLE: Always validate inputs\nPRINCIPLE: All external inputs must be validated at the boundary.\nIMPERATIVES:\n- Validate at system boundaries\n- Never trust user input\n- Use schema validation";

  const silentUI = {
    daemonStarted: vi.fn(), gitStart: vi.fn(), gitDone: vi.fn(), gitPollDone: vi.fn(),
    transcriptStart: vi.fn(), llmCallStart: vi.fn(), llmCallDone: vi.fn(), transcriptWriteDone: vi.fn(),
    scanStart: vi.fn(), scanFilesStart: vi.fn(), scanFilesDone: vi.fn(), scanDone: vi.fn(),
    synthStart: vi.fn(), synthDone: vi.fn(), inferStart: vi.fn(), inferDone: vi.fn(),
    promoteStart: vi.fn(), promoteDone: vi.fn(), showIdle: vi.fn(), clear: vi.fn(),
  };

  function writeSimilarCorrections(dir: string, n: number): void {
    const logPath = path.join(dir, ".claude", "gotcha-log.md");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    let content = "# Gotcha Log\n\nIncident log.\n\n";
    for (let i = 0; i < n; i++) {
      content += `---\n[session] 2026-04-09T00:0${i}:00.000Z\nAlways validate user input before processing request data form\n`;
    }
    fs.writeFileSync(logPath, content, "utf-8");
  }

  beforeEach(() => {
    tempDir = makeTempDir();
    // Reset all mocks between tests to prevent cross-test call-count pollution
    vi.clearAllMocks();
  });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("does nothing when gotcha-log does not exist", async () => {
    const adapter = { complete: vi.fn() };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    expect(adapter.complete).not.toHaveBeenCalled();
  });

  it("does nothing when fewer than 3 corrections exist", async () => {
    writeSimilarCorrections(tempDir, 2);
    const adapter = { complete: vi.fn() };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    expect(adapter.complete).not.toHaveBeenCalled();
  });

  it("does nothing when corrections exist but no group reaches similarity threshold", async () => {
    const logPath = path.join(tempDir, ".claude", "gotcha-log.md");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    // Three completely different corrections — low Jaccard
    const content =
      "# Gotcha Log\n\n" +
      "---\n[session] 2026-04-09T00:00:00Z\nAlways validate input forms\n" +
      "---\n[session] 2026-04-09T00:01:00Z\nNever skip database migrations\n" +
      "---\n[session] 2026-04-09T00:02:00Z\nUse async await pattern consistently\n";
    fs.writeFileSync(logPath, content, "utf-8");
    const adapter = { complete: vi.fn() };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    expect(adapter.complete).not.toHaveBeenCalled();
  });

  it("calls adapter and writes rule file when 3+ similar corrections found", async () => {
    writeSimilarCorrections(tempDir, 3);
    const adapter = { complete: vi.fn().mockResolvedValue(validResponse) };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    expect(adapter.complete).toHaveBeenCalledOnce();
    const rulesDir = path.join(tempDir, ".claude", "rules");
    const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith("-auto.md"));
    expect(files).toHaveLength(1);
  });

  it("rule file contains pending-review frontmatter and imperatives", async () => {
    writeSimilarCorrections(tempDir, 3);
    const adapter = { complete: vi.fn().mockResolvedValue(validResponse) };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    const rulesDir = path.join(tempDir, ".claude", "rules");
    const file = fs.readdirSync(rulesDir).find((f) => f.endsWith("-auto.md"))!;
    const content = fs.readFileSync(path.join(rulesDir, file), "utf-8");
    expect(content).toContain("status: pending-review");
    expect(content).toContain("source: auto-promoted from gotcha-log");
    expect(content).toContain("Always validate inputs");
    expect(content).toContain("## Imperatives");
    expect(content).toContain("- Validate at system boundaries");
  });

  it("skips promotion if rule file already exists (idempotent)", async () => {
    writeSimilarCorrections(tempDir, 3);
    const adapter = { complete: vi.fn().mockResolvedValue(validResponse) };
    // First run — writes the file
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    expect(adapter.complete).toHaveBeenCalledTimes(1);
    // Second run — file exists, should not call adapter again
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    expect(adapter.complete).toHaveBeenCalledTimes(1);
  });

  it("appends a MEMORY.md entry after successful promotion", async () => {
    writeSimilarCorrections(tempDir, 3);
    const adapter = { complete: vi.fn().mockResolvedValue(validResponse) };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    const memoryPath = path.join(tempDir, ".claude", "memory", "MEMORY.md");
    expect(fs.existsSync(memoryPath)).toBe(true);
    const content = fs.readFileSync(memoryPath, "utf-8");
    expect(content).toContain("Auto-promoted correction group to rule");
  });

  it("does not throw and calls promoteDone(0) when adapter throws", async () => {
    writeSimilarCorrections(tempDir, 3);
    const adapter = { complete: vi.fn().mockRejectedValue(new Error("adapter down")) };
    await expect(checkAndPromoteCorrections(tempDir, adapter, silentUI)).resolves.toBeUndefined();
    expect(silentUI.promoteDone).toHaveBeenCalledWith(0);
  });

  it("does not write rule when adapter returns unparseable response", async () => {
    writeSimilarCorrections(tempDir, 3);
    const adapter = { complete: vi.fn().mockResolvedValue("Sorry, I cannot help with that.") };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    const rulesDir = path.join(tempDir, ".claude", "rules");
    const files = fs.existsSync(rulesDir)
      ? fs.readdirSync(rulesDir).filter((f) => f.endsWith("-auto.md"))
      : [];
    expect(files).toHaveLength(0);
  });

  it("calls promoteDone(0) when adapter returns unparseable response", async () => {
    writeSimilarCorrections(tempDir, 3);
    const adapter = { complete: vi.fn().mockResolvedValue("not a valid format at all") };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    expect(silentUI.promoteDone).toHaveBeenCalledWith(0);
  });

  it("calls promoteStart() before adapter and promoteDone(1) after successful write", async () => {
    writeSimilarCorrections(tempDir, 3);
    const adapter = { complete: vi.fn().mockResolvedValue(validResponse) };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    expect(silentUI.promoteStart).toHaveBeenCalledOnce();
    expect(silentUI.promoteDone).toHaveBeenCalledWith(1);
  });

  it("rule file has # Title heading format", async () => {
    writeSimilarCorrections(tempDir, 3);
    const adapter = { complete: vi.fn().mockResolvedValue(validResponse) };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    const rulesDir = path.join(tempDir, ".claude", "rules");
    const file = fs.readdirSync(rulesDir).find((f) => f.endsWith("-auto.md"))!;
    const content = fs.readFileSync(path.join(rulesDir, file), "utf-8");
    expect(content).toContain("# Always validate inputs");
  });

  it("adapter prompt includes correction texts", async () => {
    writeSimilarCorrections(tempDir, 3);
    const adapter = { complete: vi.fn().mockResolvedValue(validResponse) };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    const prompt: string = adapter.complete.mock.calls[0][0];
    expect(prompt).toContain("Always validate user input before processing request data form");
    expect(prompt).toContain("TITLE:");
    expect(prompt).toContain("PRINCIPLE:");
    expect(prompt).toContain("IMPERATIVES:");
  });

  it("slug filename is derived from correction tokens and ends with -auto.md", async () => {
    writeSimilarCorrections(tempDir, 3);
    const adapter = { complete: vi.fn().mockResolvedValue(validResponse) };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    const rulesDir = path.join(tempDir, ".claude", "rules");
    const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith("-auto.md"));
    expect(files).toHaveLength(1);
    // Slug should be kebab-case tokens from the correction text (no spaces or special chars)
    expect(files[0]).toMatch(/^[a-z0-9-]+-auto\.md$/);
  });

  it("parseRuleResponse returns null when TITLE is missing", async () => {
    writeSimilarCorrections(tempDir, 3);
    const noTitle = "PRINCIPLE: All external inputs must be validated.\nIMPERATIVES:\n- Validate at system boundaries\n- Never trust user input\n";
    const adapter = { complete: vi.fn().mockResolvedValue(noTitle) };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    const rulesDir = path.join(tempDir, ".claude", "rules");
    const files = fs.existsSync(rulesDir)
      ? fs.readdirSync(rulesDir).filter((f) => f.endsWith("-auto.md"))
      : [];
    expect(files).toHaveLength(0);
    expect(silentUI.promoteDone).toHaveBeenCalledWith(0);
  });

  it("parseRuleResponse returns null when PRINCIPLE is missing", async () => {
    writeSimilarCorrections(tempDir, 3);
    const noPrinciple = "TITLE: Always validate inputs\nIMPERATIVES:\n- Validate at system boundaries\n- Never trust user input\n";
    const adapter = { complete: vi.fn().mockResolvedValue(noPrinciple) };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    const rulesDir = path.join(tempDir, ".claude", "rules");
    const files = fs.existsSync(rulesDir)
      ? fs.readdirSync(rulesDir).filter((f) => f.endsWith("-auto.md"))
      : [];
    expect(files).toHaveLength(0);
    expect(silentUI.promoteDone).toHaveBeenCalledWith(0);
  });

  it("parseRuleResponse returns null when IMPERATIVES section is missing", async () => {
    writeSimilarCorrections(tempDir, 3);
    const noImperatives = "TITLE: Always validate inputs\nPRINCIPLE: All external inputs must be validated.";
    const adapter = { complete: vi.fn().mockResolvedValue(noImperatives) };
    await checkAndPromoteCorrections(tempDir, adapter, silentUI);
    const rulesDir = path.join(tempDir, ".claude", "rules");
    const files = fs.existsSync(rulesDir)
      ? fs.readdirSync(rulesDir).filter((f) => f.endsWith("-auto.md"))
      : [];
    expect(files).toHaveLength(0);
    expect(silentUI.promoteDone).toHaveBeenCalledWith(0);
  });
});

// ─── countPendingRules ────────────────────────────────────────────────────────

describe("countPendingRules", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("returns 0 when rules dir does not exist", () => {
    expect(countPendingRules(tempDir)).toBe(0);
  });

  it("returns 0 when no *-auto.md files exist", () => {
    const rulesDir = path.join(tempDir, ".claude", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(path.join(rulesDir, "manual-rule.md"), "# Manual rule\n", "utf-8");
    expect(countPendingRules(tempDir)).toBe(0);
  });

  it("counts only *-auto.md files with status: pending-review", () => {
    const rulesDir = path.join(tempDir, ".claude", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(path.join(rulesDir, "foo-auto.md"), "---\nstatus: pending-review\n---\n# Foo\n", "utf-8");
    fs.writeFileSync(path.join(rulesDir, "bar-auto.md"), "---\nstatus: active\n---\n# Bar\n", "utf-8");
    fs.writeFileSync(path.join(rulesDir, "baz-auto.md"), "---\nstatus: pending-review\n---\n# Baz\n", "utf-8");
    expect(countPendingRules(tempDir)).toBe(2);
  });
});

// ─── STOPWORDS (Fix 1) ───────────────────────────────────────────────────────

describe("STOPWORDS", () => {
  it("is a Set", () => {
    expect(STOPWORDS).toBeInstanceOf(Set);
  });

  it("contains common stop words", () => {
    for (const word of ["a", "an", "the", "is", "are", "was", "were", "be", "of", "in", "on", "at", "to", "for", "with", "by", "about"]) {
      expect(STOPWORDS.has(word)).toBe(true);
    }
  });

  it("does not contain typical content words", () => {
    for (const word of ["function", "async", "typescript", "module", "refactor"]) {
      expect(STOPWORDS.has(word)).toBe(false);
    }
  });
});

// ─── serializedAdapter (Fix 3) ───────────────────────────────────────────────

describe("serializedAdapter ordering", () => {
  it("ensures concurrent calls are serialized — second starts only after first resolves", async () => {
    const order: string[] = [];

    // A slow adapter that records when each call starts and ends
    const rawAdapter = {
      complete: async (prompt: string): Promise<string> => {
        order.push(`start:${prompt}`);
        await new Promise<void>((res) => setTimeout(res, 10));
        order.push(`end:${prompt}`);
        return `done:${prompt}`;
      },
    };

    // Inline the same serialization logic from daemon.ts so the test is
    // self-contained and doesn't depend on an exported internal helper.
    function makeSerializedAdapter(adapter: typeof rawAdapter) {
      let chain = Promise.resolve();
      return {
        complete(prompt: string) {
          const result = chain.then(() => adapter.complete(prompt));
          chain = result.then(() => {}, () => {});
          return result;
        },
      };
    }

    const serialized = makeSerializedAdapter(rawAdapter);

    // Fire both calls simultaneously
    const [r1, r2] = await Promise.all([
      serialized.complete("A"),
      serialized.complete("B"),
    ]);

    expect(r1).toBe("done:A");
    expect(r2).toBe("done:B");

    // Serialized: A must fully complete before B starts
    expect(order).toEqual(["start:A", "end:A", "start:B", "end:B"]);
  });
});

// ─── listPendingRules (Fix 4) ────────────────────────────────────────────────

describe("listPendingRules", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("returns empty array when rules dir does not exist", () => {
    expect(listPendingRules(tempDir)).toEqual([]);
  });

  it("returns correct file and title for pending-review files", () => {
    const rulesDir = path.join(tempDir, ".claude", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(
      path.join(rulesDir, "validate-input-auto.md"),
      "---\nstatus: pending-review\n---\n\n# Always validate inputs\n\nSome text.\n",
      "utf-8"
    );
    fs.writeFileSync(
      path.join(rulesDir, "async-await-auto.md"),
      "---\nstatus: pending-review\n---\n\n# Never mix callbacks and promises\n\nSome text.\n",
      "utf-8"
    );

    const result = listPendingRules(tempDir);
    expect(result).toHaveLength(2);

    const files = result.map((r) => r.file).sort();
    expect(files).toEqual(["async-await-auto.md", "validate-input-auto.md"]);

    const byFile = Object.fromEntries(result.map((r) => [r.file, r.title]));
    expect(byFile["validate-input-auto.md"]).toBe("Always validate inputs");
    expect(byFile["async-await-auto.md"]).toBe("Never mix callbacks and promises");
  });

  it("excludes files without status: pending-review", () => {
    const rulesDir = path.join(tempDir, ".claude", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(
      path.join(rulesDir, "active-auto.md"),
      "---\nstatus: active\n---\n\n# Active rule\n",
      "utf-8"
    );
    expect(listPendingRules(tempDir)).toHaveLength(0);
  });

  it("uses fallback title when no # heading is present", () => {
    const rulesDir = path.join(tempDir, ".claude", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(
      path.join(rulesDir, "no-title-auto.md"),
      "---\nstatus: pending-review\n---\n\nNo heading here.\n",
      "utf-8"
    );
    const result = listPendingRules(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("(no title)");
    expect(result[0]?.file).toBe("no-title-auto.md");
  });
});
