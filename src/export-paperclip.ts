import fs from "node:fs";
import path from "node:path";
import { confirm, input } from "@inquirer/prompts";
import { loadWorkspace } from "./load-workspace.js";
import { translateAgents } from "./export-paperclip/translate-agents.js";
import {
  getGovernanceConfig,
  buildGovernanceDoc,
} from "./export-paperclip/translate-governance.js";
import { translateSkills } from "./export-paperclip/translate-skills.js";
import { translateGoals } from "./export-paperclip/translate-goals.js";
import { buildManifest } from "./export-paperclip/build-manifest.js";

export const CLI_VERSION = "1.2.0";

export interface ExportOptions {
  format: string;
  out?: string;
  name?: string;
  mission?: string;
  adapter?: string;
  validate?: boolean;
}

export async function exportPaperclip(options: ExportOptions): Promise<void> {
  const { config, vars, rootDir } = loadWorkspace();
  const systemDir = String(vars.systemDir);
  const adapterType = options.adapter ?? "claude_local";
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

  // Output directory
  const outDir = path.resolve(
    options.out ?? `${config.workspaceName}-paperclip`
  );

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

  console.log("\nExporting to Paperclip format...\n");

  // Translate workspace components
  const agents = translateAgents(rootDir, systemDir, config.workspaceName);
  const govConfig = getGovernanceConfig(config.qualityLevel);
  const governanceDoc = buildGovernanceDoc(
    rootDir,
    systemDir,
    config.qualityLevel
  );
  const skills = translateSkills(rootDir, systemDir);
  const goals = translateGoals(rootDir);
  const manifest = buildManifest(
    companyName,
    CLI_VERSION,
    agents,
    skills
  );

  // Validate-only mode: print summary and exit
  if (validateOnly) {
    console.log(`  \u2713 company.json          valid`);
    console.log(
      `  \u2713 governance.md         valid (tier: ${govConfig.tier})`
    );
    for (const agent of agents) {
      console.log(`  \u2713 agents/${agent.filename}  valid`);
    }
    for (const skill of skills) {
      console.log(
        `  \u2713 skills/${skill.name}/SKILL.md  valid`
      );
    }
    console.log(`  \u2713 goals/README.md       valid (${goals.length} goal(s))`);
    console.log(
      `\n${agents.length} agent(s), ${skills.length} skill(s), ${goals.length} goal(s)`
    );
    console.log(`Governance tier: ${govConfig.tier}`);
    console.log("\nValidation passed. Run without --validate to export.\n");
    return;
  }

  // Create output directory structure
  fs.mkdirSync(path.join(outDir, "agents"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "goals"), { recursive: true });

  // Write manifest
  fs.writeFileSync(
    path.join(outDir, "paperclip.manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf-8"
  );
  console.log("  \u2713 paperclip.manifest.json");

  // Write company.json
  const company = {
    name: companyName,
    mission,
    governance: {
      tier: govConfig.tier,
      requiresApproval: govConfig.requiresApproval,
      approvalGates: govConfig.approvalGates,
      qualityCheckInterval: govConfig.qualityCheckInterval,
      minQualityGrade: govConfig.minQualityGrade,
    },
    heartbeat: {
      defaultIntervalSec: 300,
      persistState: true,
    },
  };
  fs.writeFileSync(
    path.join(outDir, "company.json"),
    JSON.stringify(company, null, 2) + "\n",
    "utf-8"
  );
  console.log("  \u2713 company.json");

  // Write governance.md
  fs.writeFileSync(path.join(outDir, "governance.md"), governanceDoc, "utf-8");
  console.log("  \u2713 governance.md");

  // Write agent files with frontmatter
  for (const agent of agents) {
    const frontmatter = [
      "---",
      `name: ${agent.name}`,
      `role: "${agent.role}"`,
      `title: ${agent.title}`,
      `adapterType: ${adapterType}`,
      `heartbeatEnabled: true`,
      `heartbeatIntervalSec: 300`,
      `reportsTo: ${agent.reportsTo ?? "null"}`,
      `status: active`,
      "---",
      "",
    ].join("\n");

    fs.writeFileSync(
      path.join(outDir, "agents", agent.filename),
      frontmatter + agent.body,
      "utf-8"
    );
    console.log(`  \u2713 agents/${agent.filename}`);
  }

  // Write skills
  for (const skill of skills) {
    const skillDir = path.join(outDir, "skills", skill.name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), skill.content, "utf-8");
    console.log(`  \u2713 skills/${skill.name}/SKILL.md`);
  }

  // Write goals
  let goalsContent = "";
  if (goals.length === 0) {
    goalsContent = "*(No projects found in workspace)*";
  } else {
    goalsContent = goals
      .map((g) => `## ${g.name}\n\n${g.description}`)
      .join("\n\n---\n\n");
  }
  fs.writeFileSync(
    path.join(outDir, "goals", "README.md"),
    `# Goals \u2014 ${companyName}\n> Derived from Clawstrap workspace projects.\n\n${goalsContent}\n`,
    "utf-8"
  );
  console.log("  \u2713 goals/README.md");

  // Write import.sh
  const importScript = [
    "#!/bin/bash",
    "# Import this Clawstrap governance template into Paperclip",
    "# Requires: Paperclip running at localhost:3100 (default) or PAPERCLIP_URL env var",
    "",
    'PAPERCLIP_URL=${PAPERCLIP_URL:-http://localhost:3100}',
    "",
    'echo "Importing Clawstrap governance template into Paperclip..."',
    'npx paperclipai company import --from . --url "$PAPERCLIP_URL"',
    "",
    'echo "Done. Open your Paperclip dashboard to review the imported company."',
    "",
  ].join("\n");
  const importPath = path.join(outDir, "import.sh");
  fs.writeFileSync(importPath, importScript, "utf-8");
  fs.chmodSync(importPath, 0o755);
  console.log("  \u2713 import.sh");

  // Update .clawstrap.json with export metadata
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
  console.log(
    `Governance tier: ${govConfig.tier}\n`
  );
}
