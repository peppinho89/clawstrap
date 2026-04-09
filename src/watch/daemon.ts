import fs from "node:fs";
import path from "node:path";
import type { ClawstrapConfig } from "../schema.js";
import { runGitObserver } from "./git.js";
import { runScan } from "./scan.js";
import { writeConventions } from "./writers.js";
import { watchTranscriptDir, processTranscript } from "./transcripts.js";
import { createAdapter } from "./adapters/index.js";
import { clearPid } from "./pid.js";
import type { WatchUI } from "./ui.js";

export async function runDaemon(
  rootDir: string,
  config: ClawstrapConfig,
  ui: WatchUI
): Promise<void> {
  // Graceful shutdown
  const cleanup: Array<() => void> = [];
  const shutdown = () => {
    cleanup.forEach((fn) => fn());
    ui.clear();
    clearPid(rootDir);
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  ui.daemonStarted();

  // 1. Git observer (cold start or incremental)
  const sinceCommit = config.watchState?.lastGitCommit ?? null;
  ui.gitStart();
  const gitResult = await runGitObserver(rootDir, sinceCommit);
  ui.gitDone(gitResult ? { entriesWritten: gitResult.entriesWritten, lastCommit: gitResult.lastCommit } : null);
  let lastGitCommit: string | null = gitResult?.lastCommit ?? sinceCommit;
  if (gitResult) {
    updateWatchState(rootDir, { lastGitCommit: gitResult.lastCommit });
  }

  // 2. Transcript watcher
  const adapter = createAdapter(config);
  const stopTranscripts = watchTranscriptDir(rootDir, async (filePath) => {
    ui.transcriptStart(path.basename(filePath));
    ui.llmCallStart();
    const result = await processTranscript(filePath, adapter);
    ui.llmCallDone(result
      ? { decisions: result.decisions.length, corrections: result.corrections.length, openThreads: result.openThreads.length }
      : null);
    if (result) {
      const { appendToMemory, appendToGotchaLog, appendToFutureConsiderations, appendToOpenThreads } = await import("./writers.js");
      if (result.decisions.length) appendToMemory(rootDir, result.decisions, "session");
      if (result.corrections.length) appendToGotchaLog(rootDir, result.corrections);
      if (result.deferredIdeas.length) appendToFutureConsiderations(rootDir, result.deferredIdeas);
      if (result.openThreads.length) appendToOpenThreads(rootDir, result.openThreads);
      updateWatchState(rootDir, { lastTranscriptAt: new Date().toISOString() });
      ui.transcriptWriteDone();
    }
  });
  cleanup.push(stopTranscripts);

  // 3. Periodic git polling
  // Note: lastGitCommit is tracked in-memory. If .clawstrap.json is externally
  // edited between ticks the in-memory value takes precedence; the config file
  // is reconciled on the next successful poll write.
  let gitRunning = false;
  const pollIntervalMinutes = config.watch?.git?.pollIntervalMinutes ?? 5;
  const gitPollTimer = setInterval(async () => {
    if (gitRunning) return;
    gitRunning = true;
    try {
      const result = await runGitObserver(rootDir, lastGitCommit);
      if (result && result.entriesWritten > 0) {
        ui.gitPollDone({ entriesWritten: result.entriesWritten, lastCommit: result.lastCommit });
      }
      // Always advance lastGitCommit (even when entriesWritten === 0) so the
      // next tick does not re-process the same zero-entry commits.
      if (result) {
        lastGitCommit = result.lastCommit;
        updateWatchState(rootDir, { lastGitCommit: result.lastCommit });
      }
    } finally {
      gitRunning = false;
    }
  }, pollIntervalMinutes * 60 * 1000);
  cleanup.push(() => clearInterval(gitPollTimer));

  // 4. Periodic convention scan
  const intervalDays = config.watch?.scan?.intervalDays ?? 7;
  const lastScan = config.watchState?.lastScanAt ? new Date(config.watchState.lastScanAt) : null;
  const msSinceLastScan = lastScan ? Date.now() - lastScan.getTime() : Infinity;
  const scanIntervalMs = intervalDays * 24 * 60 * 60 * 1000;

  const doScan = async () => {
    ui.scanStart(lastScan);
    ui.scanFilesStart();
    const sections = await runScan(rootDir);
    ui.scanFilesDone();
    writeConventions(rootDir, sections);
    updateWatchState(rootDir, { lastScanAt: new Date().toISOString() });
    ui.scanDone(sections.naming[0] ?? "");
  };

  // Run immediately if overdue
  if (msSinceLastScan >= scanIntervalMs) {
    await doScan();
  }

  // Schedule recurring scan
  const scanTimer = setInterval(doScan, scanIntervalMs);
  cleanup.push(() => clearInterval(scanTimer));

  ui.showIdle(path.join(rootDir, "tmp", "sessions"));

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
