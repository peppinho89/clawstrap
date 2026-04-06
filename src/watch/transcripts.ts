import fs from "node:fs";
import path from "node:path";
import type { Adapter } from "./adapters/index.js";

export interface TranscriptResult {
  decisions: string[];
  corrections: string[];
  deferredIdeas: string[];
  openThreads: string[];
}

/**
 * Process a single session transcript file using the adapter.
 * Returns null if the file can't be parsed or adapter fails.
 */
export async function processTranscript(
  filePath: string,
  adapter: Adapter
): Promise<TranscriptResult | null> {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const prompt = `Extract structured information from this session summary. Return ONLY valid JSON with no markdown or explanation.

Session content:
${content}

Return JSON with exactly these keys:
{
  "decisions": ["what approach was chosen and why"],
  "corrections": ["what the agent got wrong and how it was fixed"],
  "deferredIdeas": ["ideas mentioned but not acted on"],
  "openThreads": ["unresolved questions or next steps"]
}
Each item must be a concise one-sentence string. Arrays may be empty.`;

  let response: string;
  try {
    response = await adapter.complete(prompt);
  } catch {
    return null;
  }

  try {
    // Strip any markdown code fences if present
    const cleaned = response
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```\s*$/m, "")
      .trim();

    const parsed = JSON.parse(cleaned) as unknown;

    if (typeof parsed !== "object" || parsed === null) return null;

    const obj = parsed as Record<string, unknown>;
    const toArray = (v: unknown): string[] => {
      if (!Array.isArray(v)) return [];
      return v.filter((item): item is string => typeof item === "string");
    };

    return {
      decisions: toArray(obj["decisions"]),
      corrections: toArray(obj["corrections"]),
      deferredIdeas: toArray(obj["deferredIdeas"]),
      openThreads: toArray(obj["openThreads"]),
    };
  } catch {
    return null;
  }
}

/**
 * Set up fs.watch on tmp/sessions/ directory.
 * Calls onNewFile when a new .md file appears.
 * Creates the directory if it doesn't exist.
 * Returns a cleanup function.
 */
export function watchTranscriptDir(
  rootDir: string,
  onNewFile: (filePath: string) => Promise<void>
): () => void {
  const sessionsDir = path.join(rootDir, "tmp", "sessions");
  fs.mkdirSync(sessionsDir, { recursive: true });

  const watcher = fs.watch(sessionsDir, (event, filename) => {
    if (event !== "rename" || !filename) return;
    if (!filename.endsWith(".md")) return;

    const filePath = path.join(sessionsDir, filename);
    // Only process if the file exists (not a deletion)
    if (!fs.existsSync(filePath)) return;

    onNewFile(filePath).catch(() => {
      // Swallow errors — don't crash the watcher
    });
  });

  return () => {
    watcher.close();
  };
}
