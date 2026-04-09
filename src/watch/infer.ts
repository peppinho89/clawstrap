import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Adapter } from "./adapters/index.js";
import type { ConventionSections } from "./writers.js";

const CODE_EXTS = new Set([".ts", ".js", ".tsx", ".jsx"]);
const SKIP_DIRS = new Set([".git", "node_modules", "tmp", "dist", ".claude"]);
const MAX_FILES = 10;
const MAX_LINES_PER_FILE = 150;
const MIN_FILES = 3;

/** Walk rootDir and return all code files, excluding test files. */
function walkCodeFiles(rootDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string, depth = 0): void {
    if (depth > 8) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && CODE_EXTS.has(path.extname(entry.name))) {
        if (!/\.(test|spec)\.(ts|js|tsx|jsx)$/.test(entry.name)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(rootDir);
  return results;
}

/** Get recently changed code files via git log. Returns relative paths. */
function getRecentlyChangedFiles(rootDir: string): string[] {
  try {
    const output = execSync(
      `git -C "${rootDir}" log --format='' --name-only -n 100`,
      { encoding: "utf-8" }
    ).trim();
    if (!output) return [];

    const seen = new Set<string>();
    const files: string[] = [];
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      const ext = path.extname(trimmed);
      if (!CODE_EXTS.has(ext)) continue;
      if (/\.(test|spec)\.(ts|js|tsx|jsx)$/.test(trimmed)) continue;
      const abs = path.join(rootDir, trimmed);
      if (fs.existsSync(abs)) files.push(abs);
    }
    return files;
  } catch {
    return [];
  }
}

/** Read a file, truncating to MAX_LINES_PER_FILE lines. */
function readTruncated(filePath: string, rootDir: string): string {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
  const lines = content.split("\n");
  const relPath = path.relative(rootDir, filePath);
  const truncated = lines.length > MAX_LINES_PER_FILE
    ? lines.slice(0, MAX_LINES_PER_FILE).join("\n") + "\n// ... truncated"
    : lines.join("\n");
  return `=== ${relPath} ===\n${truncated}`;
}

/**
 * Use the LLM adapter to infer architectural and design patterns from source
 * files. Returns an array of imperative rule strings, or an empty array if
 * inference fails or too few files are available.
 */
export async function inferArchitecturePatterns(
  rootDir: string,
  syntacticSections: ConventionSections,
  adapter: Adapter
): Promise<string[]> {
  // Prefer recently changed files; fall back to full walk
  let candidates = getRecentlyChangedFiles(rootDir);
  if (candidates.length < MIN_FILES) {
    candidates = walkCodeFiles(rootDir);
  }
  if (candidates.length < MIN_FILES) return [];

  const sampled = candidates.slice(0, MAX_FILES);
  const fileSamples = sampled
    .map((f) => readTruncated(f, rootDir))
    .filter(Boolean)
    .join("\n\n");

  if (!fileSamples) return [];

  const syntacticSummary = [
    `Naming: ${syntacticSections.naming.join("; ")}`,
    `Imports: ${syntacticSections.imports.join("; ")}`,
    `Error handling: ${syntacticSections.errorHandling.join("; ")}`,
  ].join("\n");

  const prompt =
    `You are analysing a software project to infer its architectural and design conventions.\n\n` +
    `Syntactic analysis already found:\n${syntacticSummary}\n\n` +
    `Source file samples:\n${fileSamples}\n\n` +
    `Based on the code, identify 3–8 architectural or design patterns as imperative rules.\n` +
    `Rules must be specific to this codebase, not generic best practices.\n` +
    `Format: one rule per line, starting with "Always", "Never", or "When".\n` +
    `Output only the rules — no explanation, no numbering, no markdown.`;

  let response: string;
  try {
    response = await adapter.complete(prompt);
  } catch {
    return [];
  }

  const rules = response
    .replace(/^```(?:markdown)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .split("\n")
    .map((line) => line.replace(/^\s*[-*\d.]+\s*/, "").trim())
    .filter((line) => /^(Always|Never|When)\b/i.test(line));

  return rules;
}
