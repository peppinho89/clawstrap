import path from "node:path";
import fs from "node:fs";
import { loadWorkspace } from "./load-workspace.js";
import { isDaemonRunning, writePid, clearPid, readPid } from "./watch/pid.js";
import { runGitObserver } from "./watch/git.js";
import { runScan } from "./watch/scan.js";
import { writeConventions } from "./watch/writers.js";
import { runDaemon } from "./watch/daemon.js";
import { createUI } from "./watch/ui.js";
import { inferArchitecturePatterns } from "./watch/infer.js";
import { createAdapter } from "./watch/adapters/index.js";

export async function watch(options: {
  stop?: boolean;
  silent?: boolean;
  once?: boolean;
}): Promise<void> {
  const { config, rootDir } = loadWorkspace();

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

  const silent = options.silent ?? config.watch?.silent ?? false;
  const ui = createUI(silent);

  // --once: run all observers once, exit
  if (options.once) {
    ui.gitStart();
    const gitResult = await runGitObserver(rootDir, config.watchState?.lastGitCommit ?? null);
    ui.gitDone(gitResult ? { entriesWritten: gitResult.entriesWritten, lastCommit: gitResult.lastCommit } : null);
    if (gitResult) {
      persistWatchState(rootDir, { lastGitCommit: gitResult.lastCommit });
    }

    const lastScanAt = config.watchState?.lastScanAt ? new Date(config.watchState.lastScanAt) : null;
    ui.scanStart(lastScanAt);
    ui.scanFilesStart();
    const sections = await runScan(rootDir);
    ui.scanFilesDone();

    if (config.watch?.adapter) {
      const adapter = createAdapter(config);
      ui.inferStart();
      const rules = await inferArchitecturePatterns(rootDir, sections, adapter);
      ui.inferDone(rules.length > 0 ? rules.length : null);
      if (rules.length > 0) sections.architecture = rules;
    }

    writeConventions(rootDir, sections);
    persistWatchState(rootDir, { lastScanAt: new Date().toISOString() });
    ui.scanDone(sections.naming[0] ?? "");
    return;
  }

  // Default: run foreground daemon
  if (isDaemonRunning(rootDir)) {
    const pid = readPid(rootDir);
    console.log(`\nWatch is already running (pid ${pid}). Use --stop to stop it.\n`);
    return;
  }

  injectWatchHook(rootDir, config);

  // Write own PID so `--stop` from another terminal can kill this process
  writePid(rootDir, process.pid);

  await runDaemon(rootDir, config, ui);
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
