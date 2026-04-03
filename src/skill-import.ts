import fs from "node:fs";
import path from "node:path";

export interface ResolvedUrl {
  rawUrl: string;
  repoUrl: string;
  skillName: string;
}

export interface ResolvedSkill {
  name: string;
  description: string;
  triggers: string;
  content: string;
  source: string;
  references: Array<{ path: string; content: string }>;
}

/**
 * Parse a skill URL or shorthand into a raw GitHub URL.
 *
 * Supports:
 *   skills.sh/org/repo/skill
 *   github.com/org/repo/tree/branch/path/to/skill
 *   raw.githubusercontent.com/org/repo/branch/path/SKILL.md
 *   org/repo/skill (shorthand)
 */
export function resolveSkillUrl(input: string): ResolvedUrl {
  let url = input.trim();

  // 1. Raw GitHub URL — use directly
  if (url.includes("raw.githubusercontent.com")) {
    const match = url.match(
      /raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+?)(?:\/SKILL\.md)?$/
    );
    if (!match) throw new Error(`Cannot parse raw GitHub URL: ${url}`);
    const [, org, repo, branch, skillPath] = match;
    const skillName = skillPath.split("/").pop()!;
    const rawUrl = url.endsWith("/SKILL.md")
      ? url
      : `${url}/SKILL.md`;
    return {
      rawUrl,
      repoUrl: `https://github.com/${org}/${repo}`,
      skillName,
    };
  }

  // 2. skills.sh URL — resolve to GitHub
  if (url.includes("skills.sh")) {
    url = url.replace(/^https?:\/\//, "");
    const match = url.match(/skills\.sh\/([^/]+)\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error(`Cannot parse skills.sh URL: ${input}`);
    const [, org, repo, skill] = match;
    return {
      rawUrl: `https://raw.githubusercontent.com/${org}/${repo}/main/skills/${skill}/SKILL.md`,
      repoUrl: `https://github.com/${org}/${repo}`,
      skillName: skill,
    };
  }

  // 3. GitHub URL — extract org/repo/branch/path
  if (url.includes("github.com")) {
    url = url.replace(/^https?:\/\//, "");
    // github.com/org/repo/tree/branch/path/to/skill
    const treeMatch = url.match(
      /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/
    );
    if (treeMatch) {
      const [, org, repo, branch, skillPath] = treeMatch;
      const skillName = skillPath.split("/").pop()!;
      return {
        rawUrl: `https://raw.githubusercontent.com/${org}/${repo}/${branch}/${skillPath}/SKILL.md`,
        repoUrl: `https://github.com/${org}/${repo}`,
        skillName,
      };
    }
    // github.com/org/repo (no path — not enough info)
    throw new Error(
      `GitHub URL must include skill path. Example: https://github.com/org/repo/tree/main/skills/skill-name`
    );
  }

  // 4. Shorthand: org/repo/skill
  const parts = url.split("/");
  if (parts.length === 3) {
    const [org, repo, skill] = parts;
    return {
      rawUrl: `https://raw.githubusercontent.com/${org}/${repo}/main/skills/${skill}/SKILL.md`,
      repoUrl: `https://github.com/${org}/${repo}`,
      skillName: skill,
    };
  }

  throw new Error(
    `Cannot resolve skill URL: ${input}\n` +
      `Supported formats:\n` +
      `  skills.sh/org/repo/skill-name\n` +
      `  github.com/org/repo/tree/main/skills/skill-name\n` +
      `  org/repo/skill-name`
  );
}

/**
 * Parse YAML frontmatter from a SKILL.md file.
 */
function parseFrontmatter(content: string): {
  name: string;
  description: string;
  triggers: string;
  body: string;
} {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) {
    // No frontmatter — extract from markdown headings
    const nameMatch = content.match(/^#\s+(.+)/m);
    const descMatch = content.match(/^>\s*(.+)/m);
    return {
      name: nameMatch ? nameMatch[1].trim().toLowerCase().replace(/\s+/g, "-") : "imported-skill",
      description: descMatch ? descMatch[1].trim() : "",
      triggers: "",
      body: content,
    };
  }

  const [, frontmatter, body] = fmMatch;

  const nameMatch = frontmatter.match(/^name:\s*(.+)/m);
  const descMatch = frontmatter.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  const triggersMatch = frontmatter.match(/^triggers?:\s*["']?(.+?)["']?\s*$/m);

  return {
    name: nameMatch ? nameMatch[1].trim() : "imported-skill",
    description: descMatch ? descMatch[1].trim() : "",
    triggers: triggersMatch ? triggersMatch[1].trim() : "",
    body,
  };
}

/**
 * Fetch a skill from a URL. Returns parsed skill data without saving.
 */
export async function fetchSkill(input: string): Promise<ResolvedSkill> {
  const resolved = resolveSkillUrl(input);

  const res = await fetch(resolved.rawUrl);
  if (!res.ok) {
    // Try alternative path: some repos use skill-name directly without skills/ prefix
    const altUrl = resolved.rawUrl.replace("/skills/", "/");
    const altRes = await fetch(altUrl);
    if (!altRes.ok) {
      throw new Error(
        `Failed to fetch skill from ${resolved.rawUrl} (${res.status}). ` +
          `Also tried ${altUrl} (${altRes.status}).`
      );
    }
    const content = await altRes.text();
    const parsed = parseFrontmatter(content);
    return {
      name: parsed.name || resolved.skillName,
      description: parsed.description,
      triggers: parsed.triggers,
      content,
      source: input,
      references: [],
    };
  }

  const content = await res.text();
  const parsed = parseFrontmatter(content);

  // Try to fetch references (non-blocking — just check if directory exists)
  const references: Array<{ path: string; content: string }> = [];
  try {
    const refsUrl = resolved.rawUrl.replace("/SKILL.md", "");
    // Check for common reference files
    for (const refPath of [
      "references/REFERENCE.md",
      "references/FORMS.md",
    ]) {
      const refRes = await fetch(`${refsUrl}/${refPath}`);
      if (refRes.ok) {
        references.push({
          path: refPath,
          content: await refRes.text(),
        });
      }
    }
  } catch {
    // References are optional — ignore errors
  }

  return {
    name: parsed.name || resolved.skillName,
    description: parsed.description,
    triggers: parsed.triggers,
    content,
    source: input,
    references,
  };
}

/**
 * Import a skill from URL into the workspace. Fetches, saves, and updates registry.
 */
export async function importSkillToWorkspace(
  rootDir: string,
  systemDir: string,
  input: string
): Promise<ResolvedSkill> {
  const skill = await fetchSkill(input);

  const skillDir = path.join(rootDir, systemDir, "skills", skill.name);
  if (fs.existsSync(skillDir)) {
    throw new Error(
      `Skill "${skill.name}" already exists at ${systemDir}/skills/${skill.name}/`
    );
  }

  // Create skill directory and write SKILL.md
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), skill.content, "utf-8");

  // Write reference files
  for (const ref of skill.references) {
    const refPath = path.join(skillDir, ref.path);
    fs.mkdirSync(path.dirname(refPath), { recursive: true });
    fs.writeFileSync(refPath, ref.content, "utf-8");
  }

  // Update SKILL_REGISTRY.md
  const triggers = skill.triggers || skill.name;
  const registryPath = path.join(rootDir, systemDir, "skills", "SKILL_REGISTRY.md");
  if (fs.existsSync(registryPath)) {
    let registry = fs.readFileSync(registryPath, "utf-8");
    const newRow = `| ${skill.name} | \`${systemDir}/skills/${skill.name}/SKILL.md\` | ${triggers} |`;

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
          blankLine !== -1 ? tableStart + blankLine + 1 : registry.length;
        registry =
          registry.slice(0, insertPos) +
          newRow +
          "\n" +
          registry.slice(insertPos);
      }
    }

    fs.writeFileSync(registryPath, registry, "utf-8");
  }

  return skill;
}
