/**
 * Near-duplicate detection for MEMORY.md entries using Jaccard similarity on word tokens.
 */

/**
 * Tokenize a string into lowercased alphanumeric word tokens.
 */
function tokenize(text: string): Set<string> {
  const words = text.split(/\s+/).map((w) => w.replace(/[^a-z0-9]/gi, "").toLowerCase()).filter(Boolean);
  return new Set(words);
}

/**
 * Jaccard similarity on lowercased word token sets.
 */
function jaccard(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/**
 * Returns true if newEntry is too similar to any of existingEntries (>= threshold).
 */
export function isDuplicate(
  newEntry: string,
  existingEntries: string[],
  threshold = 0.75
): boolean {
  for (const existing of existingEntries) {
    if (jaccard(newEntry, existing) >= threshold) {
      return true;
    }
  }
  return false;
}

/**
 * Parse MEMORY.md content into individual entry strings.
 * Entries are delimited by lines starting with "---".
 */
export function parseMemoryEntries(content: string): string[] {
  const lines = content.split("\n");
  const entries: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.startsWith("---")) {
      if (current.length > 0) {
        const entry = current.join("\n").trim();
        if (entry) entries.push(entry);
        current = [];
      }
    } else {
      current.push(line);
    }
  }

  // Capture any trailing entry
  if (current.length > 0) {
    const entry = current.join("\n").trim();
    if (entry) entries.push(entry);
  }

  return entries;
}
