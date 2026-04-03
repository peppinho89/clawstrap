import { exec, spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { loadWorkspace } from "./load-workspace.js";

export interface DashboardOptions {
  port?: string;
}

export async function startDashboard(options: DashboardOptions): Promise<void> {
  // Verify we're in a workspace
  const { rootDir } = loadWorkspace();
  const port = parseInt(options.port ?? "4200", 10);

  // Find the dashboard directory (relative to the CLI source)
  const dashboardDir = findDashboardDir();
  if (!dashboardDir) {
    console.error(
      "\nError: Dashboard not found. The dashboard is available in development mode only.\n"
    );
    console.error("To run the dashboard:");
    console.error("  1. cd into the clawstrap repo");
    console.error("  2. cd dashboard && npm install");
    console.error(
      `  3. CLAWSTRAP_ROOT=${rootDir} PORT=${port} npx tsx api/index.ts`
    );
    console.error("  4. In another terminal: cd ui && npm run dev\n");
    process.exit(1);
  }

  console.log(`\nStarting Clawstrap Dashboard...\n`);

  // Start API server
  const apiProcess = spawn("npx", ["tsx", "api/index.ts"], {
    cwd: dashboardDir,
    env: {
      ...process.env,
      CLAWSTRAP_ROOT: rootDir,
      PORT: String(port),
    },
    stdio: "inherit",
  });

  apiProcess.on("error", (err) => {
    console.error(`\nFailed to start API server: ${err.message}\n`);
    process.exit(1);
  });

  // Open browser after a short delay to let the server start
  setTimeout(() => {
    const url = `http://localhost:${port}`;
    console.log(`\n  Dashboard: ${url}`);
    console.log(`  Press Ctrl+C to stop.\n`);
    openBrowser(url);
  }, 1500);

  // Handle cleanup
  process.on("SIGINT", () => {
    apiProcess.kill();
    process.exit(0);
  });
}

function findDashboardDir(): string | null {
  // Check relative to CWD (development: running from clawstrap repo)
  const fromCwd = path.join(process.cwd(), "dashboard");
  if (
    fs.existsSync(path.join(fromCwd, "api", "index.ts")) &&
    fs.existsSync(path.join(fromCwd, "package.json"))
  ) {
    return fromCwd;
  }

  // Check relative to the script location
  const fromScript = path.resolve(__dirname, "..", "dashboard");
  if (
    fs.existsSync(path.join(fromScript, "api", "index.ts")) &&
    fs.existsSync(path.join(fromScript, "package.json"))
  ) {
    return fromScript;
  }

  return null;
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";

  exec(`${cmd} ${url}`, () => {});
}
