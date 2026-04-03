import fs from "node:fs";
import path from "node:path";
import { input } from "@inquirer/prompts";
import { loadWorkspace } from "./load-workspace.js";
import { render } from "./template-engine.js";
import { templates } from "./templates/index.js";
import { importSkillToWorkspace } from "./skill-import.js";

export async function addSkill(
  name: string,
  options?: { from?: string }
): Promise<void> {
  const { vars, rootDir } = loadWorkspace();
  const systemDir = String(vars.systemDir);

  // Import from URL
  if (options?.from) {
    console.log(`\nImporting skill from ${options.from}...\n`);
    try {
      const skill = await importSkillToWorkspace(rootDir, systemDir, options.from);
      console.log(`  \u2713 ${systemDir}/skills/${skill.name}/SKILL.md`);
      if (skill.references.length > 0) {
        for (const ref of skill.references) {
          console.log(`  \u2713 ${systemDir}/skills/${skill.name}/${ref.path}`);
        }
      }
      console.log(`  \u2713 ${systemDir}/skills/SKILL_REGISTRY.md (updated)`);
      console.log(`\n  Source: ${skill.source}\n`);
    } catch (err) {
      console.error(
        `\nError: ${err instanceof Error ? err.message : "Failed to import skill"}\n`
      );
      process.exit(1);
    }
    return;
  }

  // Local skill creation (existing flow)
  const skillDir = path.join(rootDir, systemDir, "skills", name);
  if (fs.existsSync(skillDir)) {
    console.error(
      `\nError: skill "${name}" already exists at ${systemDir}/skills/${name}/\n`
    );
    process.exit(1);
  }

  const description = await input({
    message: "Skill description (one line):",
    validate: (v) => v.length > 0 || "Description is required",
  });

  const triggers = await input({
    message: "Trigger phrases (comma-separated):",
    validate: (v) => v.length > 0 || "At least one trigger is required",
  });

  const skillVars = {
    ...vars,
    skillName: name,
    skillDescription: description,
    skillTriggers: triggers,
  };

  fs.mkdirSync(skillDir, { recursive: true });
  const content = render(templates.newSkill, skillVars);
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf-8");

  // Update SKILL_REGISTRY.md
  const registryPath = path.join(
    rootDir,
    systemDir,
    "skills",
    "SKILL_REGISTRY.md"
  );
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
      if (headingIdx === -1) return;
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

    fs.writeFileSync(registryPath, registry, "utf-8");
  }

  console.log(`\n  \u2713 ${systemDir}/skills/${name}/SKILL.md`);
  console.log(`  \u2713 ${systemDir}/skills/SKILL_REGISTRY.md (updated)\n`);
}
