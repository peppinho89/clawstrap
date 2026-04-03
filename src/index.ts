import { Command } from "commander";
import { init } from "./init.js";
import { addAgent } from "./add-agent.js";
import { addSkill } from "./add-skill.js";
import { addProject } from "./add-project.js";
import { showStatus } from "./status.js";
import { exportPaperclip, type ExportOptions } from "./export-paperclip.js";
import { startDashboard, type DashboardOptions } from "./dashboard.js";

const program = new Command();

program
  .name("clawstrap")
  .description("Scaffold a production-ready AI agent workspace")
  .version("2.0.0");

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
  .description("Add a new skill (local or from URL)")
  .argument("[name]", "Skill name (required for local, auto-detected for import)")
  .option(
    "--from <url>",
    "Import from skills.sh, GitHub, or shorthand (org/repo/skill)"
  )
  .action(async (name: string | undefined, options: { from?: string }) => {
    if (!name && !options.from) {
      console.error(
        "\nError: provide a skill name or use --from <url> to import.\n"
      );
      process.exit(1);
    }
    await addSkill(name ?? "imported", options);
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
  .command("dashboard")
  .description("Open the workspace dashboard in your browser")
  .option("-p, --port <port>", "Server port", "4200")
  .action(async (options: DashboardOptions) => {
    await startDashboard(options);
  });

program.parse();
