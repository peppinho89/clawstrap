import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { scanWorkspace } from "../scanner.js";
import { createWatcher } from "../watcher.js";
import { deriveTemplateVars } from "../../../src/derive-vars.js";
import { loadConfig } from "../scanner.js";

export const eventsRoutes = new Hono<{ Variables: { rootDir: string } }>();

eventsRoutes.get("/events", (c) => {
  const rootDir = c.get("rootDir");

  return streamSSE(c, async (stream) => {
    let eventId = 0;

    // Send initial workspace state
    try {
      const workspace = scanWorkspace(rootDir);
      await stream.writeSSE({
        data: JSON.stringify(workspace),
        event: "workspace",
        id: String(eventId++),
      });
    } catch {
      await stream.writeSSE({
        data: JSON.stringify({ error: "Failed to scan workspace" }),
        event: "error",
        id: String(eventId++),
      });
    }

    // Set up file watcher to push updates
    let config;
    try {
      config = loadConfig(rootDir);
    } catch {
      return;
    }
    const vars = deriveTemplateVars(config);
    const systemDir = String(vars.systemDir);

    const watcher = createWatcher(rootDir, systemDir, async () => {
      try {
        const workspace = scanWorkspace(rootDir);
        await stream.writeSSE({
          data: JSON.stringify(workspace),
          event: "workspace",
          id: String(eventId++),
        });
      } catch {
        await stream.writeSSE({
          data: JSON.stringify({ error: "Failed to scan workspace after change" }),
          event: "error",
          id: String(eventId++),
        });
      }
    });

    // Send heartbeat every 30 seconds to keep the connection alive
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({
          data: "",
          event: "heartbeat",
          id: String(eventId++),
        });
      } catch {
        // Connection closed
        clearInterval(heartbeat);
      }
    }, 30_000);

    // Clean up on disconnect
    stream.onAbort(() => {
      watcher.close();
      clearInterval(heartbeat);
    });

    // Keep the stream open indefinitely
    await new Promise(() => {});
  });
});
