import fs from "node:fs";
import path from "node:path";
import { isDuplicate, parseMemoryEntries } from "./dedup.js";

export interface ConventionSections {
  naming: string[];
  imports: string[];
  testing: string[];
  errorHandling: string[];
  comments: string[];
}

function formatEntry(source: string, text: string): string {
  const ts = new Date().toISOString();
  return `---\n[${source}] ${ts}\n${text}`;
}

/**
 * Append entries to MEMORY.md with source tag + timestamp.
 * Skips entries that are near-duplicates of existing content.
 * Returns the number of entries actually written (after dedup filtering).
 */
export function appendToMemory(rootDir: string, entries: string[], source: string): number {
  const memoryPath = path.join(rootDir, ".claude", "memory", "MEMORY.md");
  fs.mkdirSync(path.dirname(memoryPath), { recursive: true });

  let existingContent = "";
  if (fs.existsSync(memoryPath)) {
    existingContent = fs.readFileSync(memoryPath, "utf-8");
  }

  const existingEntries = parseMemoryEntries(existingContent);
  const toAppend: string[] = [];

  for (const entry of entries) {
    if (!isDuplicate(entry, existingEntries)) {
      toAppend.push(formatEntry(source, entry));
    }
  }

  if (toAppend.length > 0) {
    const appendText = "\n" + toAppend.join("\n") + "\n";
    fs.appendFileSync(memoryPath, appendText, "utf-8");
  }

  return toAppend.length;
}

/**
 * Append correction entries to .claude/gotcha-log.md
 */
export function appendToGotchaLog(rootDir: string, entries: string[]): void {
  const logPath = path.join(rootDir, ".claude", "gotcha-log.md");
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(
      logPath,
      "# Gotcha Log\n\nIncident log — why rules exist.\n\n",
      "utf-8"
    );
  }

  const toAppend = entries.map((e) => formatEntry("session", e)).join("\n");
  fs.appendFileSync(logPath, "\n" + toAppend + "\n", "utf-8");
}

/**
 * Append deferred ideas to .claude/future-considerations.md
 */
export function appendToFutureConsiderations(rootDir: string, entries: string[]): void {
  const fcPath = path.join(rootDir, ".claude", "future-considerations.md");
  fs.mkdirSync(path.dirname(fcPath), { recursive: true });

  if (!fs.existsSync(fcPath)) {
    fs.writeFileSync(
      fcPath,
      "# Future Considerations\n\nDeferred ideas and potential improvements.\n\n",
      "utf-8"
    );
  }

  const toAppend = entries.map((e) => formatEntry("session", e)).join("\n");
  fs.appendFileSync(fcPath, "\n" + toAppend + "\n", "utf-8");
}

/**
 * Append open threads to .claude/memory/open-threads.md
 */
export function appendToOpenThreads(rootDir: string, entries: string[]): void {
  const otPath = path.join(rootDir, ".claude", "memory", "open-threads.md");
  fs.mkdirSync(path.dirname(otPath), { recursive: true });

  if (!fs.existsSync(otPath)) {
    fs.writeFileSync(
      otPath,
      "# Open Threads\n\nUnresolved questions and next steps.\n\n",
      "utf-8"
    );
  }

  const toAppend = entries.map((e) => formatEntry("session", e)).join("\n");
  fs.appendFileSync(otPath, "\n" + toAppend + "\n", "utf-8");
}

const AUTO_START = "<!-- CLAWSTRAP:AUTO -->";
const AUTO_END = "<!-- CLAWSTRAP:END -->";

function buildAutoBlock(sections: ConventionSections): string {
  const lines: string[] = [AUTO_START];

  lines.push("## Naming Conventions");
  if (sections.naming.length > 0) {
    for (const item of sections.naming) lines.push(`- ${item}`);
  } else {
    lines.push("- No naming conventions detected.");
  }

  lines.push("");
  lines.push("## Import Style");
  if (sections.imports.length > 0) {
    for (const item of sections.imports) lines.push(`- ${item}`);
  } else {
    lines.push("- No import patterns detected.");
  }

  lines.push("");
  lines.push("## Testing");
  if (sections.testing.length > 0) {
    for (const item of sections.testing) lines.push(`- ${item}`);
  } else {
    lines.push("- No test files detected.");
  }

  lines.push("");
  lines.push("## Error Handling");
  if (sections.errorHandling.length > 0) {
    for (const item of sections.errorHandling) lines.push(`- ${item}`);
  } else {
    lines.push("- No error handling patterns detected.");
  }

  lines.push("");
  lines.push("## Comments");
  if (sections.comments.length > 0) {
    for (const item of sections.comments) lines.push(`- ${item}`);
  } else {
    lines.push("- No comment patterns detected.");
  }

  lines.push(AUTO_END);
  return lines.join("\n");
}

/**
 * Write/update .claude/rules/conventions.md.
 * Replaces only the <!-- CLAWSTRAP:AUTO --> ... <!-- CLAWSTRAP:END --> block.
 * Preserves everything outside that block.
 * If the file doesn't exist, creates it from scratch.
 */
export function writeConventions(rootDir: string, sections: ConventionSections): void {
  const conventionsPath = path.join(rootDir, ".claude", "rules", "conventions.md");
  fs.mkdirSync(path.dirname(conventionsPath), { recursive: true });

  const autoBlock = buildAutoBlock(sections);

  if (!fs.existsSync(conventionsPath)) {
    const content = [
      "# Conventions",
      "",
      "> Auto-generated by `clawstrap analyze`. Do not edit the AUTO block manually.",
      "",
      autoBlock,
      "",
      "<!-- Add manual conventions below this line -->",
      "",
    ].join("\n");
    fs.writeFileSync(conventionsPath, content, "utf-8");
    return;
  }

  const existing = fs.readFileSync(conventionsPath, "utf-8");
  const startIdx = existing.indexOf(AUTO_START);
  const endIdx = existing.indexOf(AUTO_END);

  if (startIdx === -1 || endIdx === -1) {
    // No existing auto block — append it
    const updated = existing.trimEnd() + "\n\n" + autoBlock + "\n";
    fs.writeFileSync(conventionsPath, updated, "utf-8");
  } else {
    // Replace the existing auto block
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + AUTO_END.length);
    const updated = before + autoBlock + after;
    fs.writeFileSync(conventionsPath, updated, "utf-8");
  }
}
