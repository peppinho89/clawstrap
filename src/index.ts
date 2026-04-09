import { Command } from "commander";
import { init } from "./init.js";
import { addAgent } from "./add-agent.js";
import { addSkill } from "./add-skill.js";
import { addProject } from "./add-project.js";
import { showStatus } from "./status.js";
import { exportPaperclip, type ExportOptions } from "./export-paperclip.js";
import { watch } from "./watch.js";
import { analyze } from "./analyze.js";

const program = new Command();

program
  .name("clawstrap")
  .description("Scaffold a production-ready AI agent workspace")
  .version("1.5.1");

program
  .command("init")
  .description("Create a new AI workspace in the current directory")
  .argument("[directory]", "Target directory", ".")
  .option("-y, --yes", "Use defaults, skip prompts")
  .option("--sdd", "Enable Spec-Driven Development mode")
  .action(async (directory: string, options: { yes?: boolean; sdd?: boolean }) => {
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

program
  .command("export")
  .description("Export workspace to another format")
  .requiredOption("-f, --format <format>", "Export format (paperclip)")
  .option("-o, --out <dir>", "Output directory")
  .option("-n, --name <name>", "Company name")
  .option("-m, --mission <mission>", "Company mission")
  .option("-a, --adapter <type>", "Agent adapter type (default: claude_local)")
  .option("--validate", "Validate export without writing")
  .action(async (options: ExportOptions) => {
    if (options.format !== "paperclip") {
      console.error(
        `\nUnknown format: ${options.format}. Supported: paperclip\n`
      );
      process.exit(1);
    }
    await exportPaperclip(options);
  });

program
  .command("watch")
  .description("Start adaptive memory daemon for this workspace")
  .option("--stop", "Stop the running daemon")
  .option("--silent", "Run without output")
  .option("--once", "Run all observers once and exit (no persistent daemon)")
  .action(async (options: { stop?: boolean; silent?: boolean; once?: boolean }) => {
    await watch(options);
  });

program
  .command("analyze")
  .description("Run codebase convention scan immediately")
  .action(async () => {
    await analyze();
  });

program.parse();
