import { Command } from "commander";
import { init } from "./init.js";

const program = new Command();

program
  .name("clawstrap")
  .description("Scaffold a production-ready AI agent workspace")
  .version("1.0.0");

program
  .command("init")
  .description("Create a new AI workspace in the current directory")
  .argument("[directory]", "Target directory", ".")
  .option("-y, --yes", "Use defaults, skip prompts")
  .action(async (directory: string, options: { yes?: boolean }) => {
    await init(directory, options);
  });

program.parse();
