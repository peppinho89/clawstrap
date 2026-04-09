import fs from "node:fs";
import path from "node:path";
import { parseMemoryEntries } from "./dedup.js";
import { appendToMemory } from "./writers.js";
import type { Adapter } from "./adapters/index.js";
import type { WatchUI } from "./ui.js";
import { STOPWORDS } from "./stopwords.js";

const SIMILARITY_THRESHOLD = 0.65;
const MIN_GROUP_SIZE = 3;

// ─── similarity helpers ───────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/gi, "").toLowerCase())
      .filter((w) => w.length > 1 && !STOPWORDS.has(w))
  );
}

function jaccard(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
}

// ─── grouping ─────────────────────────────────────────────────────────────────

function groupSimilar(entries: string[]): string[][] {
  const groups: string[][] = [];
  for (const entry of entries) {
    let placed = false;
    for (const group of groups) {
      if (group.some((member) => jaccard(entry, member) >= SIMILARITY_THRESHOLD)) {
        group.push(entry);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([entry]);
  }
  return groups.filter((g) => g.length >= MIN_GROUP_SIZE);
}

// ─── slug derivation ──────────────────────────────────────────────────────────

function deriveSlug(entries: string[]): string {
  const freq = new Map<string, number>();
  for (const entry of entries) {
    for (const token of tokenize(entry)) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }
  const top = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
  return top.join("-") || "correction";
}

// ─── adapter response parsing ─────────────────────────────────────────────────

interface RuleData {
  title: string;
  principle: string;
  imperatives: string[];
}

function parseRuleResponse(response: string): RuleData | null {
  const titleMatch = response.match(/^TITLE:\s*(.+)$/m);
  const principleMatch = response.match(/^PRINCIPLE:\s*(.+)$/m);
  const imperativesMatch = response.match(/^IMPERATIVES:\s*\n((?:\s*-\s*.+\n?)+)/m);

  if (!titleMatch || !principleMatch || !imperativesMatch) return null;

  const imperatives = imperativesMatch[1]
    .split("\n")
    .map((l) => l.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);

  if (imperatives.length === 0) return null;

  return {
    title: titleMatch[1].trim(),
    principle: principleMatch[1].trim(),
    imperatives,
  };
}

// ─── rule file writer ─────────────────────────────────────────────────────────

function writeRuleFile(rulesDir: string, slug: string, data: RuleData): void {
  fs.mkdirSync(rulesDir, { recursive: true });
  const imperativeLines = data.imperatives.map((i) => `- ${i}`).join("\n");
  const content =
    `---\nstatus: pending-review\ngenerated: ${new Date().toISOString()}\nsource: auto-promoted from gotcha-log\n---\n\n` +
    `# ${data.title}\n\n${data.principle}\n\n## Imperatives\n\n${imperativeLines}\n`;
  fs.writeFileSync(path.join(rulesDir, `${slug}-auto.md`), content, "utf-8");
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Read gotcha-log.md, find groups of 3+ similar corrections, promote each
 * group to a draft rule file in .claude/rules/. Skips groups already promoted.
 * No-ops if no adapter configured or fewer than MIN_GROUP_SIZE corrections exist.
 */
export async function checkAndPromoteCorrections(
  rootDir: string,
  adapter: Adapter,
  ui: WatchUI
): Promise<void> {
  const logPath = path.join(rootDir, ".claude", "gotcha-log.md");
  if (!fs.existsSync(logPath)) return;

  let content: string;
  try {
    content = fs.readFileSync(logPath, "utf-8");
  } catch {
    return;
  }

  const entries = parseMemoryEntries(content);
  if (entries.length < MIN_GROUP_SIZE) return;

  const promotableGroups = groupSimilar(entries);
  if (promotableGroups.length === 0) return;

  const rulesDir = path.join(rootDir, ".claude", "rules");
  let written = 0;

  for (const group of promotableGroups) {
    const slug = deriveSlug(group);
    const ruleFile = path.join(rulesDir, `${slug}-auto.md`);
    if (fs.existsSync(ruleFile)) continue; // already promoted

    ui.promoteStart();

    const prompt =
      `You are analysing a set of recurring corrections from an AI coding session log.\n\n` +
      `Corrections:\n${group.map((e, i) => `${i + 1}. ${e}`).join("\n")}\n\n` +
      `Synthesise these into a governance rule. Respond in this exact format:\n\n` +
      `TITLE: (short rule name, 2–5 words)\n` +
      `PRINCIPLE: (one sentence — the core principle this rule enforces)\n` +
      `IMPERATIVES:\n` +
      `- (specific imperative 1)\n` +
      `- (specific imperative 2)\n` +
      `- (specific imperative 3)\n\n` +
      `Output only the structured response — no explanation, no markdown fences.`;

    let response: string;
    try {
      response = await adapter.complete(prompt);
    } catch {
      ui.promoteDone(0);
      continue;
    }

    const data = parseRuleResponse(response);
    if (!data) {
      ui.promoteDone(0);
      continue;
    }

    try {
      writeRuleFile(rulesDir, slug, data);
      appendToMemory(rootDir, [`Auto-promoted correction group to rule: ${slug}-auto.md — "${data.title}"`], "promote");
      written++;
      ui.promoteDone(1);
    } catch {
      ui.promoteDone(0);
    }
  }

  // If no groups were new (all skipped), emit nothing
  void written;
}

// ─── status helper ────────────────────────────────────────────────────────────

export interface PendingRule {
  file: string;
  title: string;
}

/**
 * Return all .claude/rules/*-auto.md files with status: pending-review,
 * each with its filename and the first `# Heading` found in the file.
 */
export function listPendingRules(rootDir: string): PendingRule[] {
  const rulesDir = path.join(rootDir, ".claude", "rules");
  if (!fs.existsSync(rulesDir)) return [];
  const results: PendingRule[] = [];
  for (const entry of fs.readdirSync(rulesDir)) {
    if (!entry.endsWith("-auto.md")) continue;
    try {
      const content = fs.readFileSync(path.join(rulesDir, entry), "utf-8");
      if (!content.includes("status: pending-review")) continue;
      const headingMatch = content.match(/^#\s+(.+)$/m);
      const title = headingMatch ? headingMatch[1].trim() : "(no title)";
      results.push({ file: entry, title });
    } catch {
      // skip unreadable files
    }
  }
  return results;
}

/** Count .claude/rules/*-auto.md files with status: pending-review */
export function countPendingRules(rootDir: string): number {
  return listPendingRules(rootDir).length;
}
