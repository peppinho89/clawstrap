import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { appendToMemory } from "./writers.js";
import { STOPWORDS } from "./stopwords.js";

export interface GitObserverResult {
  lastCommit: string;  // SHA of the most recent commit processed
  entriesWritten: number;
}

interface CommitEntry {
  sha: string;
  subject: string;
  author: string;
  date: string;
  files: string[];
}

function parseGitLog(output: string): CommitEntry[] {
  const entries: CommitEntry[] = [];
  const lines = output.split("\n");
  let current: CommitEntry | null = null;

  for (const line of lines) {
    if (line.includes("|||")) {
      // Header line: SHA|||subject|||author|||date
      if (current) entries.push(current);
      const parts = line.split("|||");
      current = {
        sha: parts[0]?.trim() ?? "",
        subject: parts[1]?.trim() ?? "",
        author: parts[2]?.trim() ?? "",
        date: parts[3]?.trim() ?? "",
        files: [],
      };
    } else if (line.trim() && current) {
      // File path line
      current.files.push(line.trim());
    }
  }
  if (current) entries.push(current);

  return entries.filter((e) => e.sha.length > 0);
}

function getTopDirs(entries: CommitEntry[]): string[] {
  const dirCount: Map<string, number> = new Map();
  for (const entry of entries) {
    const seenDirs = new Set<string>();
    for (const file of entry.files) {
      const dir = path.dirname(file);
      if (dir !== "." && !seenDirs.has(dir)) {
        seenDirs.add(dir);
        dirCount.set(dir, (dirCount.get(dir) ?? 0) + 1);
      }
    }
  }
  return Array.from(dirCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([dir]) => dir);
}

function getCoChangingFiles(entries: CommitEntry[], minCommits = 3): Array<[string, string]> {
  const pairCount: Map<string, number> = new Map();
  for (const entry of entries) {
    const files = entry.files.slice().sort();
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = `${files[i]}|||${files[j]}`;
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
  }
  return Array.from(pairCount.entries())
    .filter(([, count]) => count >= minCommits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => key.split("|||") as [string, string]);
}

function getRecurringWords(entries: CommitEntry[]): string[] {
  const wordCount: Map<string, number> = new Map();
  for (const entry of entries) {
    const words = entry.subject
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ""))
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));
    for (const word of new Set(words)) {
      wordCount.set(word, (wordCount.get(word) ?? 0) + 1);
    }
  }
  return Array.from(wordCount.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Run git observer.
 * - If sinceCommit is null: cold start (full history)
 * - If sinceCommit is a SHA: incremental (only new commits)
 * Returns null if no git repo or no commits.
 */
export async function runGitObserver(
  rootDir: string,
  sinceCommit: string | null
): Promise<GitObserverResult | null> {
  // Check for .git directory
  if (!fs.existsSync(path.join(rootDir, ".git"))) {
    return null;
  }

  let headSha: string;
  try {
    headSha = execSync(`git -C "${rootDir}" rev-parse HEAD`, {
      encoding: "utf-8",
    }).trim();
  } catch {
    return null;
  }

  if (!headSha) return null;

  // If incremental and already at HEAD, nothing to do
  if (sinceCommit && sinceCommit === headSha) {
    return { lastCommit: headSha, entriesWritten: 0 };
  }

  let logOutput: string;
  try {
    const rangeArg = sinceCommit ? `${sinceCommit}..HEAD` : "";
    const cmd = `git -C "${rootDir}" log ${rangeArg} --pretty=format:"%H|||%s|||%ae|||%ad" --date=short --name-only`;
    logOutput = execSync(cmd, { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }

  if (!logOutput) {
    return { lastCommit: headSha, entriesWritten: 0 };
  }

  const entries = parseGitLog(logOutput);
  if (entries.length === 0) {
    return { lastCommit: headSha, entriesWritten: 0 };
  }

  const memoryEntries: string[] = [];

  // Insight 1: Co-changing files
  const coChangingPairs = getCoChangingFiles(entries, 3);
  if (coChangingPairs.length > 0) {
    const pairs = coChangingPairs.map(([a, b]) => `${a} <-> ${b}`).join(", ");
    memoryEntries.push(`Co-changing file pairs (frequently modified together): ${pairs}`);
  }

  // Insight 2: Top churn directories
  const topDirs = getTopDirs(entries);
  if (topDirs.length > 0) {
    memoryEntries.push(`Top high-churn directories (most commits): ${topDirs.join(", ")}`);
  }

  // Insight 3: Recurring words in commit messages
  const recurringWords = getRecurringWords(entries);
  if (recurringWords.length > 0) {
    memoryEntries.push(`Recurring themes in recent commits: ${recurringWords.join(", ")}`);
  }

  // Summary entry
  const dateRange = entries.length > 0
    ? `from ${entries[entries.length - 1]?.date ?? "?"} to ${entries[0]?.date ?? "?"}`
    : "";
  memoryEntries.push(
    `Git history analyzed: ${entries.length} commit(s) ${dateRange}. Authors: ${[...new Set(entries.map((e) => e.author))].join(", ")}`
  );

  if (memoryEntries.length > 0) {
    appendToMemory(rootDir, memoryEntries, "git");
  }

  return { lastCommit: headSha, entriesWritten: memoryEntries.length };
}
