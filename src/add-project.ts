import fs from "node:fs";
import path from "node:path";
import { input } from "@inquirer/prompts";
import { loadWorkspace } from "./load-workspace.js";
import { render } from "./template-engine.js";
import { templates } from "./templates/index.js";

export async function addProject(name: string): Promise<void> {
  const { vars, rootDir } = loadWorkspace();

  const projectDir = path.join(rootDir, "projects", name);
  if (fs.existsSync(projectDir)) {
    console.error(`\nError: project "${name}" already exists at projects/${name}/\n`);
    process.exit(1);
  }

  const description = await input({
    message: "Project description (1-2 sentences):",
    validate: (v) => v.length > 0 || "Description is required",
  });

  const projectVars = {
    ...vars,
    projectName: name,
    projectDescription: description,
  };

  fs.mkdirSync(projectDir, { recursive: true });

  const readme = render(templates.addProjectReadme, projectVars);
  fs.writeFileSync(path.join(projectDir, "README.md"), readme, "utf-8");

  const process_ = render(templates.addProjectProcess, projectVars);
  fs.writeFileSync(path.join(projectDir, "process.md"), process_, "utf-8");

  console.log(`\n  \u2713 projects/${name}/README.md`);
  console.log(`  \u2713 projects/${name}/process.md\n`);
}
