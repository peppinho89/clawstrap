import fs from "node:fs";
import path from "node:path";
import type { ClawstrapConfig } from "../schema.js";
import { runGitObserver } from "./git.js";
import { runScan } from "./scan.js";
import { writeConventions } from "./writers.js";
import { watchTranscriptDir, processTranscript } from "./transcripts.js";
import { createAdapter } from "./adapters/index.js";
import { clearPid } from "./pid.js";

export async function runDaemon(
  rootDir: string,
  config: ClawstrapConfig
): Promise<void> {
  const silent = config.watch?.silent ?? false;
  const log = silent ? () => {} : (msg: string) => process.stdout.write(msg + "\n");

  // Graceful shutdown
  const cleanup: Array<() => void> = [];
  const shutdown = () => {
    cleanup.forEach((fn) => fn());
    clearPid(rootDir);
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  log("[clawstrap watch] daemon started");

  // 1. Git observer (cold start or incremental)
  const sinceCommit = config.watchState?.lastGitCommit ?? null;
  const gitResult = await runGitObserver(rootDir, sinceCommit);
  if (gitResult) {
    updateWatchState(rootDir, { lastGitCommit: gitResult.lastCommit });
    log(`[clawstrap watch] git: ${gitResult.entriesWritten} entries written`);
  }

  // 2. Transcript watcher
  const adapter = createAdapter(config);
  const stopTranscripts = watchTranscriptDir(rootDir, async (filePath) => {
    log(`[clawstrap watch] transcript: processing ${path.basename(filePath)}`);
    const result = await processTranscript(filePath, adapter);
    if (result) {
      const { appendToMemory, appendToGotchaLog, appendToFutureConsiderations } = await import("./writers.js");
      if (result.decisions.length) appendToMemory(rootDir, result.decisions, "session");
      if (result.corrections.length) appendToGotchaLog(rootDir, result.corrections);
      if (result.deferredIdeas.length) appendToFutureConsiderations(rootDir, result.deferredIdeas);
      updateWatchState(rootDir, { lastTranscriptAt: new Date().toISOString() });
      log(
        `[clawstrap watch] transcript: decisions=${result.decisions.length} corrections=${result.corrections.length}`
      );
    }
  });
  cleanup.push(stopTranscripts);

  // 3. Periodic convention scan
  const intervalDays = config.watch?.scan?.intervalDays ?? 7;
  const lastScan = config.watchState?.lastScanAt ? new Date(config.watchState.lastScanAt) : null;
  const msSinceLastScan = lastScan ? Date.now() - lastScan.getTime() : Infinity;
  const scanIntervalMs = intervalDays * 24 * 60 * 60 * 1000;

  const doScan = async () => {
    log("[clawstrap watch] scan: running convention scan...");
    const sections = await runScan(rootDir);
    writeConventions(rootDir, sections);
    updateWatchState(rootDir, { lastScanAt: new Date().toISOString() });
    log("[clawstrap watch] scan: conventions.md updated");
  };

  // Run immediately if overdue
  if (msSinceLastScan >= scanIntervalMs) {
    await doScan();
  }

  // Schedule recurring scan
  const scanTimer = setInterval(doScan, scanIntervalMs);
  cleanup.push(() => clearInterval(scanTimer));

  log("[clawstrap watch] watching for changes...");

  // Keep process alive
  await new Promise<never>(() => {});
}

/** Read config, update watchState fields, write back */
function updateWatchState(rootDir: string, updates: Record<string, string>): void {
  const configPath = path.join(rootDir, ".clawstrap.json");
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    raw["watchState"] = { ...(raw["watchState"] as Record<string, unknown> ?? {}), ...updates };
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2) + "\n", "utf-8");
  } catch {
    // Best-effort — don't crash the daemon on a write failure
  }
}
