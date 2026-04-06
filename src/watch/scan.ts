import fs from "node:fs";
import path from "node:path";
import type { ConventionSections } from "./writers.js";

const SKIP_DIRS = new Set([".git", "node_modules", "tmp", "dist", ".claude"]);
const CODE_EXTS = new Set([".ts", ".js", ".tsx", ".jsx"]);

function walkDir(dir: string, maxDepth = 10, depth = 0): string[] {
  if (depth > maxDepth) return [];
  let results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath, maxDepth, depth + 1));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

type NamingCase = "kebab-case" | "camelCase" | "snake_case" | "PascalCase" | "other";

function detectNamingCase(name: string): NamingCase {
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(name)) return "kebab-case";
  if (/^[A-Z][A-Z0-9_]*$/.test(name)) return "other"; // ALL_CAPS / SCREAMING files
  if (/^[A-Z][a-zA-Z0-9]+$/.test(name)) return "PascalCase";
  if (/^[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/.test(name)) return "camelCase";
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name)) return "snake_case";
  return "other";
}

function analyzeNaming(files: string[]): string[] {
  const counts: Record<NamingCase, number> = {
    "kebab-case": 0,
    camelCase: 0,
    snake_case: 0,
    PascalCase: 0,
    other: 0,
  };
  const examples: Record<NamingCase, string[]> = {
    "kebab-case": [],
    camelCase: [],
    snake_case: [],
    PascalCase: [],
    other: [],
  };

  for (const file of files) {
    const base = path.basename(file, path.extname(file));
    const style = detectNamingCase(base);
    counts[style]++;
    if (examples[style].length < 3) examples[style].push(base);
  }

  const dominant = (Object.entries(counts) as [NamingCase, number][])
    .sort((a, b) => b[1] - a[1])
    .filter(([key]) => key !== "other")[0];

  if (!dominant || dominant[1] === 0) {
    return ["No dominant file naming convention detected."];
  }

  const [style, count] = dominant;
  const exampleList = examples[style].slice(0, 3).join(", ");
  const result = [`Dominant file naming: ${style} (${count} files). Examples: ${exampleList}`];

  // Show runners-up if close
  const total = Object.values(counts).reduce((a, b) => a + b, 0) - counts.other;
  if (total > 0) {
    const pct = Math.round((count / total) * 100);
    result.push(`${style} used in ${pct}% of named files.`);
  }

  return result;
}

function analyzeImports(files: string[]): string[] {
  const sample = files.filter((f) => CODE_EXTS.has(path.extname(f))).slice(0, 20);
  let relativeCount = 0;
  let absoluteCount = 0;
  let barrelCount = 0;

  for (const file of sample) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const importLines = content.split("\n").filter((l) => /^import\s/.test(l));
    for (const line of importLines) {
      if (/from\s+['"]\.\.?\//.test(line)) relativeCount++;
      else if (/from\s+['"]/.test(line)) absoluteCount++;
    }

    // Check for barrel export (index.ts in a directory)
    const base = path.basename(file, path.extname(file));
    if (base === "index") barrelCount++;
  }

  const results: string[] = [];
  const total = relativeCount + absoluteCount;
  if (total > 0) {
    const relPct = Math.round((relativeCount / total) * 100);
    results.push(
      `Import style: ${relPct}% relative (./), ${100 - relPct}% absolute/alias. Analyzed ${sample.length} files.`
    );
  } else {
    results.push("No import statements found in sampled files.");
  }

  if (barrelCount > 0) {
    results.push(`Barrel exports detected: ${barrelCount} index file(s) found.`);
  }

  return results;
}

function analyzeTesting(files: string[]): string[] {
  const testPatterns: string[] = [];
  let hasTestExt = false;
  let hasSpecExt = false;
  let hasTestsDir = false;

  for (const file of files) {
    const base = path.basename(file);
    if (/\.test\.(ts|js|tsx|jsx)$/.test(base)) hasTestExt = true;
    if (/\.spec\.(ts|js|tsx|jsx)$/.test(base)) hasSpecExt = true;
    if (file.includes("/__tests__/") || file.includes("\\__tests__\\")) hasTestsDir = true;
  }

  if (hasTestExt) testPatterns.push("*.test.ts/js");
  if (hasSpecExt) testPatterns.push("*.spec.ts/js");
  if (hasTestsDir) testPatterns.push("__tests__/ directories");

  if (testPatterns.length === 0) {
    return ["No test files detected."];
  }

  return [`Test patterns found: ${testPatterns.join(", ")}`];
}

function analyzeErrorHandling(files: string[]): string[] {
  const sample = files.filter((f) => CODE_EXTS.has(path.extname(f))).slice(0, 20);
  let tryCatchCount = 0;
  let resultTypeCount = 0;

  for (const file of sample) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const tryCatches = (content.match(/\btry\s*\{/g) ?? []).length;
    const resultTypes = (content.match(/Result<|Either</g) ?? []).length;
    tryCatchCount += tryCatches;
    resultTypeCount += resultTypes;
  }

  const results: string[] = [];
  if (tryCatchCount > 0 && resultTypeCount === 0) {
    results.push(`Error handling: try/catch dominant (${tryCatchCount} occurrences in ${sample.length} files).`);
  } else if (resultTypeCount > 0 && tryCatchCount === 0) {
    results.push(`Error handling: Result/Either type pattern dominant (${resultTypeCount} occurrences).`);
  } else if (tryCatchCount > 0 && resultTypeCount > 0) {
    const dominant = tryCatchCount >= resultTypeCount ? "try/catch" : "Result/Either";
    results.push(
      `Error handling: mixed — ${tryCatchCount} try/catch and ${resultTypeCount} Result/Either. Dominant: ${dominant}.`
    );
  } else {
    results.push(`No explicit error handling patterns detected in ${sample.length} sampled files.`);
  }

  return results;
}

function analyzeComments(files: string[]): string[] {
  const sample = files.filter((f) => CODE_EXTS.has(path.extname(f))).slice(0, 20);
  let jsdocCount = 0;
  let inlineCount = 0;
  let totalLines = 0;

  for (const file of sample) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    totalLines += lines.length;
    jsdocCount += (content.match(/\/\*\*/g) ?? []).length;
    inlineCount += lines.filter((l) => /^\s*\/\//.test(l)).length;
  }

  const commentDensity = totalLines > 0 ? (jsdocCount + inlineCount) / totalLines : 0;
  let density: string;
  if (commentDensity > 0.15) density = "heavy";
  else if (commentDensity > 0.05) density = "moderate";
  else density = "minimal";

  return [
    `Comment density: ${density} (${jsdocCount} JSDoc blocks, ${inlineCount} inline comments across ${sample.length} files).`,
  ];
}

/**
 * Scan rootDir recursively and infer conventions.
 */
export async function runScan(rootDir: string): Promise<ConventionSections> {
  const allFiles = walkDir(rootDir);

  return {
    naming: analyzeNaming(allFiles),
    imports: analyzeImports(allFiles),
    testing: analyzeTesting(allFiles),
    errorHandling: analyzeErrorHandling(allFiles),
    comments: analyzeComments(allFiles),
  };
}
