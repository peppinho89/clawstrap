import fs from "node:fs";
import path from "node:path";
import { confirm, input } from "@inquirer/prompts";
import { loadWorkspace } from "./load-workspace.js";
import { translateAgents } from "./export-paperclip/translate-agents.js";
import {
  getGovernanceConfig,
} from "./export-paperclip/translate-governance.js";
import { translateSkills } from "./export-paperclip/translate-skills.js";
import { translateGoals } from "./export-paperclip/translate-goals.js";

export const CLI_VERSION = "1.2.0";

export interface ExportOptions {
  format: string;
  out?: string;
  name?: string;
  mission?: string;
  adapter?: string;
  validate?: boolean;
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function exportPaperclip(options: ExportOptions): Promise<void> {
  const { config, vars, rootDir } = loadWorkspace();
  const systemDir = String(vars.systemDir);
  const validateOnly = options.validate ?? false;

  // Determine company name and mission
  const companyName =
    options.name ??
    (await input({
      message: "Company name:",
      default: config.workspaceName,
    }));

  const mission =
    options.mission ??
    (await input({
      message: "Company mission (one line):",
      default: `Governed AI workspace for ${String(vars.workloadLabel).toLowerCase()}`,
    }));

  const companySlug = toSlug(companyName);

  // Output directory
  const outDir = path.resolve(
    options.out ?? `${config.workspaceName}-paperclip`
  );

  // Translate workspace components
  const skills = translateSkills(rootDir, systemDir);
  const skillSlugs = skills.map((s) => s.name);
  const agents = translateAgents(rootDir, systemDir, companyName, skillSlugs);
  const govConfig = getGovernanceConfig(config.qualityLevel);
  const goals = translateGoals(rootDir);
  const nonCeoAgents = agents.filter((a) => a.slug !== "ceo");

  // Validate-only mode
  if (validateOnly) {
    console.log("\nValidating Paperclip export...\n");
    console.log("  \u2713 COMPANY.md            valid");
    console.log("  \u2713 .paperclip.yaml       valid");
    for (const agent of agents) {
      console.log(`  \u2713 agents/${agent.slug}/AGENTS.md  valid`);
    }
    if (nonCeoAgents.length > 0) {
      console.log("  \u2713 teams/engineering/TEAM.md  valid");
    }
    for (const skill of skills) {
      console.log(`  \u2713 skills/${skill.name}/SKILL.md  valid`);
    }
    console.log(
      `\n${agents.length} agent(s), ${skills.length} skill(s), ${goals.length} goal(s)`
    );
    console.log(`Governance tier: ${govConfig.tier}`);
    console.log("\nValidation passed. Run without --validate to export.\n");
    return;
  }

  // Re-export check
  if (fs.existsSync(outDir)) {
    const proceed = await confirm({
      message: `Output directory already exists at ${outDir}. Overwrite?`,
      default: false,
    });
    if (!proceed) {
      console.log("Aborted.\n");
      return;
    }
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  console.log("\nExporting to Paperclip format (agentcompanies/v1)...\n");

  // Create output directory
  fs.mkdirSync(outDir, { recursive: true });

  // 1. COMPANY.md
  const goalsYaml = goals.length > 0
    ? goals.map((g) => `  - ${g.description.split("\n")[0]}`).join("\n")
    : `  - ${mission}`;

  // Build pipeline description (numbered, like gstack)
  const pipelineLines = agents.map((a, i) => {
    return `${i + 1}. **${a.name}** ${a.title.toLowerCase()}`;
  });

  const companyMd = [
    "---",
    `name: ${companyName}`,
    `description: ${mission}`,
    `slug: ${companySlug}`,
    `schema: agentcompanies/v1`,
    `version: 1.0.0`,
    `license: MIT`,
    `authors:`,
    `  - name: Clawstrap Export`,
    `goals:`,
    goalsYaml,
    "---",
    "",
    `${companyName} is a governed AI company with built-in quality gates, approval workflows, and file-first persistence. Every agent operates under structural governance — no unsupervised work, no lost context between sessions.`,
    "",
    ...pipelineLines,
    "",
    `The philosophy: plan before building, review before shipping, persist everything to disk. Governance tier: **${govConfig.tier}** — quality checks every ${govConfig.qualityCheckInterval} tasks, minimum grade ${govConfig.minQualityGrade}.`,
    "",
    "---",
    "",
    `Generated with [Clawstrap](https://github.com/peppinho89/clawstrap) v${CLI_VERSION}`,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "COMPANY.md"), companyMd, "utf-8");
  console.log("  \u2713 COMPANY.md");

  // 2. .paperclip.yaml
  fs.writeFileSync(
    path.join(outDir, ".paperclip.yaml"),
    "schema: paperclip/v1\n",
    "utf-8"
  );
  console.log("  \u2713 .paperclip.yaml");

  // 3. Agents — agents/{slug}/AGENTS.md
  for (const agent of agents) {
    const agentDir = path.join(outDir, "agents", agent.slug);
    fs.mkdirSync(agentDir, { recursive: true });

    const frontmatterLines = [
      "---",
      `name: ${agent.name}`,
      `title: ${agent.title}`,
      `reportsTo: ${agent.reportsTo ?? "null"}`,
    ];

    if (agent.skills.length > 0) {
      frontmatterLines.push("skills:");
      for (const s of agent.skills) {
        frontmatterLines.push(`  - ${s}`);
      }
    }

    frontmatterLines.push("---");

    const agentMd = frontmatterLines.join("\n") + "\n\n" + agent.body + "\n";
    fs.writeFileSync(path.join(agentDir, "AGENTS.md"), agentMd, "utf-8");
    console.log(`  \u2713 agents/${agent.slug}/AGENTS.md`);
  }

  // 4. Team — teams/engineering/TEAM.md (if there are non-CEO agents)
  if (nonCeoAgents.length > 0) {
    const teamDir = path.join(outDir, "teams", "engineering");
    fs.mkdirSync(teamDir, { recursive: true });

    const includesList = nonCeoAgents
      .map((a) => `  - ../../agents/${a.slug}/AGENTS.md`)
      .join("\n");

    const teamMd = [
      "---",
      `name: Engineering`,
      `description: ${companyName} engineering team`,
      `slug: engineering`,
      `manager: ../../agents/ceo/AGENTS.md`,
      `includes:`,
      includesList,
      `tags:`,
      `  - engineering`,
      "---",
      "",
      `The engineering team at ${companyName}. Led by the CEO, who scopes and delegates work to specialists.`,
      "",
    ].join("\n");

    fs.writeFileSync(path.join(teamDir, "TEAM.md"), teamMd, "utf-8");
    console.log("  \u2713 teams/engineering/TEAM.md");
  }

  // 5. Skills — skills/{slug}/SKILL.md
  for (const skill of skills) {
    const skillDir = path.join(outDir, "skills", skill.name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), skill.content, "utf-8");
    console.log(`  \u2713 skills/${skill.name}/SKILL.md`);
  }

  // 6. import.sh
  const importScript = [
    "#!/bin/bash",
    "# Import this Clawstrap company into Paperclip",
    "# Requires: Paperclip running at localhost:3100 (default) or PAPERCLIP_URL env var",
    "",
    'PAPERCLIP_URL=${PAPERCLIP_URL:-http://localhost:3100}',
    "",
    'echo "Importing into Paperclip..."',
    'npx paperclipai company import . --paperclip-url "$PAPERCLIP_URL" --yes',
    "",
    'echo "Done. Open your Paperclip dashboard to review."',
    "",
  ].join("\n");
  const importPath = path.join(outDir, "import.sh");
  fs.writeFileSync(importPath, importScript, "utf-8");
  fs.chmodSync(importPath, 0o755);
  console.log("  \u2713 import.sh");

  // Update .clawstrap.json
  const updatedConfig = {
    ...config,
    lastExport: {
      format: "paperclip",
      exportedAt: new Date().toISOString(),
      outputDir: path.relative(rootDir, outDir) || outDir,
    },
  };
  fs.writeFileSync(
    path.join(rootDir, ".clawstrap.json"),
    JSON.stringify(updatedConfig, null, 2) + "\n",
    "utf-8"
  );

  console.log(
    `\nExported to ${path.relative(process.cwd(), outDir) || outDir}`
  );
  console.log(
    `${agents.length} agent(s), ${skills.length} skill(s), ${goals.length} goal(s)`
  );
  console.log(`Governance tier: ${govConfig.tier}\n`);
}
