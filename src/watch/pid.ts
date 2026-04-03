import fs from "node:fs";
import path from "node:path";

const PID_FILE = ".clawstrap.watch.pid";

export function pidPath(rootDir: string): string {
  return path.join(rootDir, PID_FILE);
}

export function writePid(rootDir: string, pid: number): void {
  fs.writeFileSync(pidPath(rootDir), String(pid), "utf-8");
}

export function readPid(rootDir: string): number | null {
  const p = pidPath(rootDir);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf-8").trim();
  const pid = parseInt(raw, 10);
  return isNaN(pid) ? null : pid;
}

export function clearPid(rootDir: string): void {
  const p = pidPath(rootDir);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export function isDaemonRunning(rootDir: string): boolean {
  const pid = readPid(rootDir);
  if (pid === null) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    clearPid(rootDir);
    return false;
  }
}
