import fs from "node:fs";
import path from "node:path";
import { parseMemoryEntries } from "./dedup.js";
import type { Adapter } from "./adapters/index.js";

const SYNTH_START = "<!-- CLAWSTRAP:SYNTHESIS:START -->";
const SYNTH_END = "<!-- CLAWSTRAP:SYNTHESIS:END -->";

const MAX_ENTRIES_TO_SEND = 20;

function extractExistingSummary(content: string): string | null {
  const startIdx = content.indexOf(SYNTH_START);
  const endIdx = content.indexOf(SYNTH_END);
  if (startIdx === -1 || endIdx === -1) return null;

  const block = content.slice(startIdx + SYNTH_START.length, endIdx).trim();
  // Strip only the known structural leading lines (heading + timestamp) by
  // walking line-by-line from the top — avoids clobbering body content that
  // happens to match the same patterns.
  const lines = block.split("\n");
  let start = 0;
  if (/^##\s+Living Summary/.test(lines[start] ?? "")) start++;
  if (/^>\s+Updated:/.test(lines[start] ?? "")) start++;
  return lines.slice(start).join("\n").trim() || null;
}

function buildSynthBlock(summary: string): string {
  const ts = new Date().toISOString();
  return [
    SYNTH_START,
    "## Living Summary",
    `> Updated: ${ts}`,
    "",
    summary,
    SYNTH_END,
  ].join("\n");
}

function writeSynthBlock(memoryPath: string, summary: string): void {
  const content = fs.existsSync(memoryPath)
    ? fs.readFileSync(memoryPath, "utf-8")
    : "";

  const block = buildSynthBlock(summary);

  const startIdx = content.indexOf(SYNTH_START);
  const endIdx = content.indexOf(SYNTH_END);

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing block
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx + SYNTH_END.length);
    fs.writeFileSync(memoryPath, before + block + after, "utf-8");
    return;
  }

  // Insert after first heading line (or at top if none).
  // Match the heading with an optional trailing newline so a file whose last
  // line is a bare `# Heading` (no newline) still inserts correctly.
  const headingMatch = /^#[^\n]*\n?/m.exec(content);
  if (headingMatch) {
    const insertAt = headingMatch.index + headingMatch[0].length;
    const updated = content.slice(0, insertAt) + "\n" + block + "\n" + content.slice(insertAt);
    fs.writeFileSync(memoryPath, updated, "utf-8");
  } else {
    fs.writeFileSync(memoryPath, block + "\n\n" + content, "utf-8");
  }
}

/**
 * Run a synthesis pass on MEMORY.md using the LLM adapter.
 * Reads the last MAX_ENTRIES_TO_SEND entries, builds a prompt, calls the
 * adapter, and writes the result as a Living Summary block at the top of
 * MEMORY.md. Returns the summary string, or null if the adapter fails.
 */
export async function synthesizeMemory(
  rootDir: string,
  adapter: Adapter
): Promise<string | null> {
  const memoryPath = path.join(rootDir, ".claude", "memory", "MEMORY.md");
  if (!fs.existsSync(memoryPath)) return null;

  const content = fs.readFileSync(memoryPath, "utf-8");
  // Strip the synthesis block before parsing entries so it doesn't pollute
  // the adapter prompt or the dedup comparison on subsequent runs.
  const contentWithoutSynthBlock = content.replace(
    /<!-- CLAWSTRAP:SYNTHESIS:START -->[\s\S]*?<!-- CLAWSTRAP:SYNTHESIS:END -->/,
    ""
  );
  const allEntries = parseMemoryEntries(contentWithoutSynthBlock);
  if (allEntries.length === 0) return null;

  const recentEntries = allEntries.slice(-MAX_ENTRIES_TO_SEND);
  const existingSummary = extractExistingSummary(content);

  let prompt: string;
  if (existingSummary) {
    prompt =
      `You are maintaining a living summary of an AI agent workspace.\n\n` +
      `Current summary:\n${existingSummary}\n\n` +
      `Recent new memory entries:\n${recentEntries.join("\n---\n")}\n\n` +
      `Update the summary to incorporate the new information. ` +
      `Write 3–5 sentences of persistent truths about how this workspace operates. ` +
      `Output only the updated paragraph — no heading, no markdown, no explanation.`;
  } else {
    prompt =
      `You are summarising an AI agent workspace from its memory log.\n\n` +
      `Recent memory entries:\n${recentEntries.join("\n---\n")}\n\n` +
      `Write a concise 3–5 sentence summary of the persistent truths about how this workspace operates. ` +
      `Output only the paragraph — no heading, no markdown, no explanation.`;
  }

  let response: string;
  try {
    response = await adapter.complete(prompt);
  } catch {
    return null;
  }

  const summary = response
    .replace(/^```(?:markdown)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  if (!summary) return null;

  try {
    writeSynthBlock(memoryPath, summary);
  } catch {
    return null;
  }

  return summary;
}
