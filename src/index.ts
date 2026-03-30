import { Command } from "commander";
import { init } from "./init.js";
import { addAgent } from "./add-agent.js";
import { addSkill } from "./add-skill.js";
import { addProject } from "./add-project.js";
import { showStatus } from "./status.js";

const program = new Command();

program
  .name("clawstrap")
  .description("Scaffold a production-ready AI agent workspace")
  .version("1.1.0");

program
  .command("init")
  .description("Create a new AI workspace in the current directory")
  .argument("[directory]", "Target directory", ".")
  .option("-y, --yes", "Use defaults, skip prompts")
  .action(async (directory: string, options: { yes?: boolean }) => {
    await init(directory, options);
  });

const add = program
  .command("add")
  .description("Add components to the workspace");

add
  .command("agent")
  .description("Add a new agent definition")
  .argument("<name>", "Agent name")
  .action(async (name: string) => {
    await addAgent(name);
  });

add
  .command("skill")
  .description("Add a new skill")
  .argument("<name>", "Skill name")
  .action(async (name: string) => {
    await addSkill(name);
  });

add
  .command("project")
  .description("Add a new project")
  .argument("<name>", "Project name")
  .action(async (name: string) => {
    await addProject(name);
  });

program
  .command("status")
  .description("Show workspace status and configuration")
  .action(async () => {
    await showStatus();
  });

program.parse();
