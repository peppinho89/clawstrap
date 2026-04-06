import path from "node:path";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { loadWorkspace } from "./load-workspace.js";
import { isDaemonRunning, writePid, clearPid, readPid } from "./watch/pid.js";
import { runGitObserver } from "./watch/git.js";
import { runScan } from "./watch/scan.js";
import { writeConventions } from "./watch/writers.js";
import { runDaemon } from "./watch/daemon.js";

export async function watch(options: {
  stop?: boolean;
  silent?: boolean;
  once?: boolean;
  _daemon?: boolean;
}): Promise<void> {
  const { config, rootDir } = loadWorkspace();

  // Internal daemon mode — called by the spawned subprocess
  if (options._daemon) {
    await runDaemon(rootDir, config);
    return;
  }

  // --stop
  if (options.stop) {
    const pid = readPid(rootDir);
    if (!pid || !isDaemonRunning(rootDir)) {
      console.log("\nNo daemon running.\n");
      return;
    }
    process.kill(pid, "SIGTERM");
    clearPid(rootDir);
    console.log(`\nDaemon stopped (pid ${pid}).\n`);
    return;
  }

  // --once: run all observers once, exit
  if (options.once) {
    console.log("\nRunning all observers once...\n");
    const gitResult = await runGitObserver(rootDir, config.watchState?.lastGitCommit ?? null);
    if (gitResult) {
      persistWatchState(rootDir, { lastGitCommit: gitResult.lastCommit });
      console.log(`  ✓ git: ${gitResult.entriesWritten} entries`);
    }
    const sections = await runScan(rootDir);
    writeConventions(rootDir, sections);
    persistWatchState(rootDir, { lastScanAt: new Date().toISOString() });
    console.log("  ✓ scan: conventions.md updated");
    console.log("\nDone.\n");
    return;
  }

  // Default: start daemon
  if (isDaemonRunning(rootDir)) {
    const pid = readPid(rootDir);
    console.log(`\nDaemon already running (pid ${pid}). Use --stop to stop it.\n`);
    return;
  }

  // Inject CLAUDE.md watch hook if not already present
  injectWatchHook(rootDir, config);

  // Spawn detached daemon subprocess
  const self = process.argv[1]; // path to dist/index.cjs
  const child = spawn(process.execPath, [self, "watch", "--_daemon"], {
    detached: true,
    stdio: "ignore",
    cwd: rootDir,
  });
  child.unref();

  if (child.pid) {
    writePid(rootDir, child.pid);
    if (!options.silent) {
      console.log(`\nDaemon started (pid ${child.pid}).`);
      console.log(`Run 'clawstrap watch --stop' to stop it.\n`);
    }
  } else {
    console.error("\nFailed to start daemon.\n");
    process.exit(1);
  }
}

function persistWatchState(rootDir: string, updates: Record<string, string>): void {
  const configPath = path.join(rootDir, ".clawstrap.json");
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    raw.watchState = { ...(raw.watchState ?? {}), ...updates };
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2) + "\n", "utf-8");
  } catch {
    // best-effort
  }
}

function injectWatchHook(rootDir: string, config: { watch?: unknown }): void {
  const governanceFile = path.join(rootDir, "CLAUDE.md");
  if (!fs.existsSync(governanceFile)) return;
  const content = fs.readFileSync(governanceFile, "utf-8");
  if (content.includes("<!-- CLAWSTRAP:WATCH -->")) return; // already injected

  const _config = config; // used to signal intentional reference
  void _config;

  const hook = `
<!-- CLAWSTRAP:WATCH -->
## Session Watch Hook

\`clawstrap watch\` is active. At every session end, write a session summary to
\`tmp/sessions/YYYY-MM-DD-HHmm.md\` using this format:

\`\`\`
## Decisions
- [what approach was chosen and why]

## Corrections
- [what the agent got wrong and how it was fixed]

## Deferred Ideas
- [mentioned but not acted on]

## Open Threads
- [unresolved questions or next steps]
\`\`\`

The watch daemon picks this up automatically and updates MEMORY.md and gotcha-log.md.
`;
  fs.appendFileSync(governanceFile, hook, "utf-8");
}
