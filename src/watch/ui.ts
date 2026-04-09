import pc from "picocolors";
import ora, { type Ora } from "ora";

export interface WatchUI {
  daemonStarted(): void;

  gitStart(): void;
  gitDone(result: { entriesWritten: number; lastCommit: string } | null): void;
  gitPollDone(result: { entriesWritten: number; lastCommit: string }): void;

  transcriptStart(filename: string): void;
  llmCallStart(): void;
  llmCallDone(counts: { decisions: number; corrections: number; openThreads: number } | null): void;
  transcriptWriteDone(): void;

  scanStart(lastRunAt: Date | null): void;
  scanFilesStart(): void;
  scanFilesDone(): void;
  scanDone(namingStyle: string): void;

  synthStart(): void;
  synthDone(summary: string | null): void;

  inferStart(): void;
  inferDone(rulesCount: number | null): void;

  showIdle(watchDir: string): void;
  clear(): void;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatAgo(date: Date | null): string {
  if (!date) return "never";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

const T = {
  branch: pc.gray("├─"),
  last:   pc.gray("└─"),
  check:  pc.green("✓"),
};

function header(label: string): void {
  process.stdout.write(`\n${pc.cyan("◆")}  ${pc.bold(label)}\n`);
}

function row(connector: string, label: string, value?: string): void {
  const val = value !== undefined ? `  ${pc.bold(value)}` : "";
  process.stdout.write(`${connector} ${label}${val}\n`);
}

// ─── SilentUI ────────────────────────────────────────────────────────────────

class SilentUI implements WatchUI {
  daemonStarted(): void {}
  gitStart(): void {}
  gitDone(_result: { entriesWritten: number; lastCommit: string } | null): void {}
  gitPollDone(_result: { entriesWritten: number; lastCommit: string }): void {}
  transcriptStart(_filename: string): void {}
  llmCallStart(): void {}
  llmCallDone(_counts: { decisions: number; corrections: number; openThreads: number } | null): void {}
  transcriptWriteDone(): void {}
  scanStart(_lastRunAt: Date | null): void {}
  scanFilesStart(): void {}
  scanFilesDone(): void {}
  scanDone(_namingStyle: string): void {}
  synthStart(): void {}
  synthDone(_summary: string | null): void {}
  inferStart(): void {}
  inferDone(_rulesCount: number | null): void {}
  showIdle(_watchDir: string): void {}
  clear(): void {}
}

// ─── RichUI ──────────────────────────────────────────────────────────────────

class RichUI implements WatchUI {
  private spinner: Ora | null = null;

  daemonStarted(): void {
    process.stdout.write(`\n${pc.cyan("clawstrap watch")} ${pc.dim("daemon started")}\n`);
  }

  // Git observer ──────────────────────────────────────────────────────────────

  gitStart(): void {
    header("Git observer");
  }

  gitDone(result: { entriesWritten: number; lastCommit: string } | null): void {
    if (!result) {
      row(T.last, pc.dim("No new commits found."));
      return;
    }
    row(T.branch, "Last processed commit", result.lastCommit.slice(0, 7));
    row(T.branch, "Entries written", String(result.entriesWritten));
    row(T.last, `Writing to MEMORY.md...  ${T.check} done`);
  }

  gitPollDone(result: { entriesWritten: number; lastCommit: string }): void {
    const time = new Date().toTimeString().slice(0, 5);
    process.stdout.write(
      `\n${pc.cyan("◆")}  ${pc.bold("Git:")}  +${result.entriesWritten} entr${result.entriesWritten === 1 ? "y" : "ies"} written` +
      `  ${pc.dim(result.lastCommit.slice(0, 7))}  ${pc.dim(time)}\n`
    );
  }

  // Transcript ────────────────────────────────────────────────────────────────

  transcriptStart(filename: string): void {
    header(`New session summary detected  ${pc.cyan(filename)}`);
  }

  llmCallStart(): void {
    this.spinner = ora({
      text: `${T.branch} Sending to LLM adapter...`,
      prefixText: "",
    }).start();
  }

  llmCallDone(counts: { decisions: number; corrections: number; openThreads: number } | null): void {
    if (this.spinner) {
      if (counts) {
        this.spinner.succeed(`${T.branch} Sending to LLM adapter...  ${T.check}`);
      } else {
        this.spinner.fail(`${T.branch} Sending to LLM adapter...  failed`);
      }
      this.spinner = null;
    }
    if (counts) {
      row(T.branch, "Decisions found    ", String(counts.decisions));
      row(T.branch, "Corrections found  ", String(counts.corrections));
      row(T.branch, "Open threads found ", String(counts.openThreads));
    }
  }

  transcriptWriteDone(): void {
    row(T.last, `Writing to memory files...  ${T.check} done`);
  }

  // Convention scan ───────────────────────────────────────────────────────────

  scanStart(lastRunAt: Date | null): void {
    header(`Convention scan  ${pc.dim(`(last run: ${formatAgo(lastRunAt)})`)}`)
  }

  scanFilesStart(): void {
    this.spinner = ora({
      text: `${T.branch} Scanning files...`,
      prefixText: "",
    }).start();
  }

  scanFilesDone(): void {
    if (this.spinner) {
      this.spinner.succeed(`${T.branch} Scanning files...  done`);
      this.spinner = null;
    }
  }

  scanDone(namingStyle: string): void {
    if (namingStyle) {
      row(T.branch, "Naming convention  ", namingStyle);
    }
    row(T.last, `Writing conventions.md...  ${T.check} done`);
  }

  // Memory synthesis ──────────────────────────────────────────────────────────

  synthStart(): void {
    this.spinner?.stop();
    this.spinner = ora({
      text: `${T.branch} Synthesising memory...`,
      prefixText: "",
    }).start();
  }

  synthDone(summary: string | null): void {
    if (this.spinner) {
      if (summary) {
        const preview = summary.length > 60 ? summary.slice(0, 60) + "…" : summary;
        this.spinner.succeed(`${T.branch} Living summary updated  ${pc.dim(preview)}`);
      } else {
        this.spinner.fail(`${T.branch} Memory synthesis failed`);
      }
      this.spinner = null;
    }
  }

  // Architecture inference ────────────────────────────────────────────────────

  inferStart(): void {
    this.spinner?.stop();
    this.spinner = ora({
      text: `${T.branch} Inferring architecture patterns...`,
      prefixText: "",
    }).start();
  }

  inferDone(rulesCount: number | null): void {
    if (this.spinner) {
      if (rulesCount !== null && rulesCount > 0) {
        this.spinner.succeed(`${T.branch} Architecture patterns inferred  ${pc.bold(String(rulesCount))} rules`);
      } else {
        this.spinner.fail(`${T.branch} Architecture inference failed`);
      }
      this.spinner = null;
    }
  }

  // Idle ──────────────────────────────────────────────────────────────────────

  showIdle(watchDir: string): void {
    process.stdout.write(`\n${pc.dim("◇")}  ${pc.dim("Watching for changes...")}\n`);
    row(T.last, pc.dim("Transcripts"), pc.dim(watchDir + "  (listening)"));
    process.stdout.write("\n");
  }

  // Cleanup ───────────────────────────────────────────────────────────────────

  clear(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }
}

// ─── factory ─────────────────────────────────────────────────────────────────

export function createUI(silent: boolean): WatchUI {
  return silent ? new SilentUI() : new RichUI();
}
