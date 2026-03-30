import fs from "node:fs";
import path from "node:path";
import { input, select } from "@inquirer/prompts";
import { loadWorkspace } from "./load-workspace.js";
import { render } from "./template-engine.js";
import { templates } from "./templates/index.js";

export async function addAgent(name: string): Promise<void> {
  const { vars, rootDir } = loadWorkspace();
  const systemDir = String(vars.systemDir);

  const outPath = path.join(rootDir, systemDir, "agents", `${name}.md`);
  if (fs.existsSync(outPath)) {
    console.error(`\nError: agent "${name}" already exists at ${systemDir}/agents/${name}.md\n`);
    process.exit(1);
  }

  const description = await input({
    message: "Agent description (one line):",
    validate: (v) => v.length > 0 || "Description is required",
  });

  const role = await select<string>({
    message: "Agent role:",
    choices: [
      { name: "Worker \u2014 performs a specific task", value: "worker" },
      { name: "Orchestrator \u2014 coordinates other agents", value: "orchestrator" },
      { name: "Reviewer \u2014 validates and QCs output", value: "reviewer" },
    ],
  });

  const agentVars = {
    ...vars,
    agentName: name,
    agentDescription: description,
    agentRole: role,
  };

  const content = render(templates.newAgent, agentVars);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, "utf-8");

  console.log(`\n  \u2713 ${systemDir}/agents/${name}.md\n`);
}
