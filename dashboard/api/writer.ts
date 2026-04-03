import fs from "node:fs";
import path from "node:path";
import { deriveTemplateVars } from "../../src/derive-vars.js";
import { loadConfig } from "./scanner.js";

// ── Name sanitization (prevents path traversal) ────────────────────────────────

function sanitizeName(name: string): string {
  // Strip path separators, dots that could traverse, and non-safe characters
  const clean = name
    .replace(/\.\./g, "")
    .replace(/[/\\]/g, "")
    .replace(/^\.+/, "")
    .trim();
  if (!clean || clean === "." || clean === "..") {
    throw new Error(`Invalid name: "${name}"`);
  }
  return clean;
}

// ── Agent Operations ───────────────────────────────────────────────────────────

export function createAgent(
  rootDir: string,
  name: string,
  description: string,
  role: string
): void {
  name = sanitizeName(name);
  const config = loadConfig(rootDir);
  const vars = deriveTemplateVars(config);
  const systemDir = String(vars.systemDir);

  const outPath = path.join(rootDir, systemDir, "agents", `${name}.md`);
  if (fs.existsSync(outPath)) {
    throw new Error(`Agent "${name}" already exists at ${systemDir}/agents/${name}.md`);
  }

  const content = `# Agent: ${name}
> **Purpose**: ${description}
> **Workspace**: ${config.workspaceName}

## Identity

You are ${name}, a ${role} agent in the ${config.workspaceName} workspace.

## Task

*(Define this agent's specific task)*

## Input

*(What this agent receives — file paths, structured data, etc.)*

## Output

Write results to: \`tmp/{task}/${name}.json\`

Return to orchestrator:
\`\`\`
Done. {N} items. File: {path}. Summary: {1-line summary}.
\`\`\`

## Rules

1. Write ALL output to the specified file — never return raw data in conversation
2. Include confidence scores for every item
3. Flag low-confidence items explicitly
4. If you encounter ambiguity, stop and report it — do not guess
5. Stay within your assigned task scope

## Approved Tools

- Read files (input only)
- Write to \`tmp/\` (output only)
- *(Add task-specific tools here)*
`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, "utf-8");
}

export interface AgentUpdate {
  description?: string;
  role?: string;
  rawMarkdown?: string;
}

export function updateAgent(
  rootDir: string,
  slug: string,
  updates: Partial<AgentUpdate>
): void {
  slug = sanitizeName(slug);
  const config = loadConfig(rootDir);
  const vars = deriveTemplateVars(config);
  const systemDir = String(vars.systemDir);

  const filePath = path.join(rootDir, systemDir, "agents", `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Agent "${slug}" not found at ${systemDir}/agents/${slug}.md`);
  }

  if (updates.rawMarkdown !== undefined) {
    // Full content replacement
    fs.writeFileSync(filePath, updates.rawMarkdown, "utf-8");
    return;
  }

  let content = fs.readFileSync(filePath, "utf-8");

  if (updates.description !== undefined) {
    content = content.replace(
      /^(>\s*\*\*Purpose\*\*:\s*)(.+)/m,
      `$1${updates.description}`
    );
  }

  if (updates.role !== undefined) {
    content = content.replace(
      /a (orchestrator|worker|reviewer) agent/,
      `a ${updates.role} agent`
    );
  }

  fs.writeFileSync(filePath, content, "utf-8");
}

export function deleteAgent(rootDir: string, slug: string): void {
  slug = sanitizeName(slug);
  const config = loadConfig(rootDir);
  const vars = deriveTemplateVars(config);
  const systemDir = String(vars.systemDir);

  const filePath = path.join(rootDir, systemDir, "agents", `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Agent "${slug}" not found at ${systemDir}/agents/${slug}.md`);
  }

  fs.unlinkSync(filePath);
}

// ── Skill Operations ───────────────────────────────────────────────────────────

export function createSkill(
  rootDir: string,
  name: string,
  description: string,
  triggers: string
): void {
  name = sanitizeName(name);
  const config = loadConfig(rootDir);
  const vars = deriveTemplateVars(config);
  const systemDir = String(vars.systemDir);

  const skillDir = path.join(rootDir, systemDir, "skills", name);
  if (fs.existsSync(skillDir)) {
    throw new Error(`Skill "${name}" already exists at ${systemDir}/skills/${name}/`);
  }

  const content = `# Skill: ${name}
> ${description}
> **Triggers**: ${triggers}

## When to Use

*(Describe when this skill should be activated)*

## Procedure

*(Step-by-step instructions for executing this skill)*

1. Step one
2. Step two
3. Step three

## Quality Checks

*(How to verify this skill's output is correct)*

- [ ] Output matches expected format
- [ ] No data loss or corruption
- [ ] Results reviewed before marking complete
`;

  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf-8");

  // Update SKILL_REGISTRY.md if it exists
  const registryPath = path.join(rootDir, systemDir, "skills", "SKILL_REGISTRY.md");
  if (fs.existsSync(registryPath)) {
    let registry = fs.readFileSync(registryPath, "utf-8");
    const newRow = `| ${name} | \`${systemDir}/skills/${name}/SKILL.md\` | ${triggers} |`;

    if (registry.includes("*(none yet)*")) {
      registry = registry.replace(
        /\| \*\(none yet\)\* \| — \| — \|/,
        newRow
      );
    } else {
      const headingIdx = registry.indexOf("## Registered Skills");
      if (headingIdx !== -1) {
        const tableStart = registry.indexOf("|", headingIdx);
        const afterTable = registry.substring(tableStart);
        const blankLine = afterTable.search(/\n\n/);
        const insertPos =
          blankLine !== -1
            ? tableStart + blankLine + 1
            : registry.length;
        registry =
          registry.slice(0, insertPos) + newRow + "\n" + registry.slice(insertPos);
      }
    }

    fs.writeFileSync(registryPath, registry, "utf-8");
  }
}

export function deleteSkill(rootDir: string, name: string): void {
  name = sanitizeName(name);
  const config = loadConfig(rootDir);
  const vars = deriveTemplateVars(config);
  const systemDir = String(vars.systemDir);

  const skillDir = path.join(rootDir, systemDir, "skills", name);
  if (!fs.existsSync(skillDir)) {
    throw new Error(`Skill "${name}" not found at ${systemDir}/skills/${name}/`);
  }

  fs.rmSync(skillDir, { recursive: true, force: true });

  // Remove from SKILL_REGISTRY.md if it exists
  const registryPath = path.join(rootDir, systemDir, "skills", "SKILL_REGISTRY.md");
  if (fs.existsSync(registryPath)) {
    let registry = fs.readFileSync(registryPath, "utf-8");
    // Remove the row matching this skill name
    const rowPattern = new RegExp(`\\| ${name} \\|[^\\n]*\\n?`, "g");
    registry = registry.replace(rowPattern, "");
    fs.writeFileSync(registryPath, registry, "utf-8");
  }
}

// ── Project Operations ─────────────────────────────────────────────────────────

export function createProject(
  rootDir: string,
  name: string,
  description: string
): void {
  name = sanitizeName(name);
  const config = loadConfig(rootDir);
  const vars = deriveTemplateVars(config);
  const generatedDate = new Date().toISOString().split("T")[0];

  const projectDir = path.join(rootDir, "projects", name);
  if (fs.existsSync(projectDir)) {
    throw new Error(`Project "${name}" already exists at projects/${name}/`);
  }

  fs.mkdirSync(projectDir, { recursive: true });

  const readme = `# Project: ${name}
> **Status**: active
> **Started**: ${generatedDate} | **Last session**: ${generatedDate}

---

## What This Project Is

${description}

---

## Key Files

| File | Role |
|------|------|
| \`process.md\` | Workflow, hooks, session checklist |

---

## SSOT Map

*(Every piece of data has exactly one authoritative location. List them here.)*

| Data | SSOT File | Derived Files |
|------|-----------|---------------|
| *(none yet)* | — | — |

---

## Current Status

**Last done**: Project created.
**Next**: —
`;

  const process_ = `# Process: ${name}
> Workflow, hooks, and session checklist for this project.
> Update this file as the workflow evolves.

---

## Execution Workflow

*(Describe the main execution loop for this project's primary task)*

---

## Known Gotchas (Project-Specific)

*(1-2 line summaries of project-specific failure modes)*

*(None yet — add entries as issues arise)*
`;

  fs.writeFileSync(path.join(projectDir, "README.md"), readme, "utf-8");
  fs.writeFileSync(path.join(projectDir, "process.md"), process_, "utf-8");
}

// ── Rule Operations ────────────────────────────────────────────────────────────

export function updateRule(
  rootDir: string,
  filename: string,
  content: string
): void {
  const config = loadConfig(rootDir);
  const vars = deriveTemplateVars(config);
  const systemDir = String(vars.systemDir);

  const rulesDir = path.join(rootDir, systemDir, "rules");
  fs.mkdirSync(rulesDir, { recursive: true });

  const filePath = path.join(rulesDir, filename);
  fs.writeFileSync(filePath, content, "utf-8");
}
