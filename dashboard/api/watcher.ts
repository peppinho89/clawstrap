import fs from "node:fs";
import path from "node:path";

/**
 * Creates a file system watcher that triggers onChange when workspace files change.
 * Watches .clawstrap.json, the system directory (e.g. .claude/), and projects/.
 * Uses a 300ms debounce to batch rapid file changes.
 */
export function createWatcher(
  rootDir: string,
  systemDir: string,
  onChange: () => void
): { close: () => void } {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const watchers: fs.FSWatcher[] = [];

  const debouncedOnChange = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onChange();
    }, 300);
  };

  // Watch .clawstrap.json
  const configPath = path.join(rootDir, ".clawstrap.json");
  if (fs.existsSync(configPath)) {
    try {
      const w = fs.watch(configPath, debouncedOnChange);
      watchers.push(w);
    } catch {
      // File watching may not be available on all platforms
    }
  }

  // Watch system directory (e.g. .claude/) recursively
  const systemPath = path.join(rootDir, systemDir);
  if (fs.existsSync(systemPath)) {
    try {
      const w = fs.watch(systemPath, { recursive: true }, debouncedOnChange);
      watchers.push(w);
    } catch {
      // Recursive watch may not be available on all platforms
    }
  }

  // Watch projects/ recursively
  const projectsPath = path.join(rootDir, "projects");
  if (fs.existsSync(projectsPath)) {
    try {
      const w = fs.watch(projectsPath, { recursive: true }, debouncedOnChange);
      watchers.push(w);
    } catch {
      // Recursive watch may not be available on all platforms
    }
  }

  return {
    close() {
      if (debounceTimer) clearTimeout(debounceTimer);
      for (const w of watchers) {
        w.close();
      }
    },
  };
}
