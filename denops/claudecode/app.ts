/**
 * dps-claudecode.vim - Claude Code integration for Vim/Neovim
 * Author: Tatsumi GAMOU
 * License: MIT
 */

import type { Denops } from "@denops/core";
import * as option from "@denops/std/option";
import * as buffer from "@denops/std/buffer";
import * as variable from "@denops/std/variable";
import { batch } from "@denops/std/batch";
import { ensureObject, ensureString } from "@denops/std/ensure";
import { join } from "@std/path";
import { exists } from "@std/fs";

// Configuration interface
interface ClaudeCodeConfig {
  port_range: { min: number; max: number };
  auto_start: boolean;
  log_level: "debug" | "info" | "warn" | "error";
  auth_required: boolean;
  prompt_buffer: {
    split_direction: "vertical" | "horizontal";
    size: number;
  };
}

// Server state
interface ServerState {
  running: boolean;
  port?: number;
  auth_token?: string;
  websocket_server?: Deno.HttpServer;
  prompt_buffer?: number;
}

const state: ServerState = {
  running: false,
};

// Main plugin entry point
export function main(denops: Denops): void {
  // Define API functions
  denops.dispatcher = {
    // Start Claude Code WebSocket server
    async start(): Promise<void> {
      if (state.running) {
        console.log("[claudecode] Server is already running");
        return;
      }

      try {
        const config = await getConfig(denops);
        const port = await findAvailablePort(config.port_range);

        if (!port) {
          throw new Error("No available ports in the specified range");
        }

        // Generate auth token
        const authToken = crypto.randomUUID();

        // Start WebSocket server
        const server = Deno.serve({
          port,
          hostname: "127.0.0.1",
          onError: (err) => {
            console.error("[claudecode] WebSocket server error:", err);
            return new Response("Internal Server Error", { status: 500 });
          },
        }, handleWebSocketRequest);

        state.websocket_server = server;
        state.port = port;
        state.auth_token = authToken;
        state.running = true;

        // Create lock file for Claude Code CLI detection
        await createLockFile(port, authToken);

        console.log(`[claudecode] Server started on port ${port}`);
        await denops.call(
          "claudecode#show_message",
          `Server started on port ${port}`,
        );
      } catch (error) {
        console.error("[claudecode] Failed to start server:", error);
        await denops.call("claudecode#handle_error", error);
      }
    },

    // Stop Claude Code WebSocket server
    async stop(): Promise<void> {
      if (!state.running) {
        console.log("[claudecode] Server is not running");
        return;
      }

      try {
        if (state.websocket_server) {
          await state.websocket_server.shutdown();
          state.websocket_server = undefined;
        }

        if (state.port) {
          await removeLockFile(state.port);
        }

        state.running = false;
        state.port = undefined;
        state.auth_token = undefined;

        console.log("[claudecode] Server stopped");
        await denops.call("claudecode#show_message", "Server stopped");
      } catch (error) {
        console.error("[claudecode] Failed to stop server:", error);
        await denops.call("claudecode#handle_error", error);
      }
    },

    // Get server status
    status(): Promise<ServerState> {
      return Promise.resolve({
        running: state.running,
        port: state.port,
        auth_token: state.auth_token ? "***" : undefined,
      });
    },

    // Open prompt buffer
    async openPrompt(): Promise<void> {
      try {
        const config = await getConfig(denops);

        // Create new buffer
        await batch(denops, async (denops) => {
          if (config.prompt_buffer.split_direction === "vertical") {
            await denops.cmd(`${config.prompt_buffer.size}vnew`);
          } else {
            await denops.cmd(`${config.prompt_buffer.size}new`);
          }
        });

        const bufnr = await denops.call("bufnr", "%") as number;

        // Configure prompt buffer
        await batch(denops, async (denops) => {
          await option.buftype.setLocal(denops, "prompt");
          await option.filetype.setLocal(denops, "claudecode");
          await option.swapfile.setLocal(denops, false);
          await option.buflisted.setLocal(denops, false);
          await option.bufhidden.setLocal(denops, "wipe");
        });

        // Set buffer content
        await buffer.replace(denops, bufnr, [
          "# Claude Code Chat",
          "",
          "Type your message below and press Enter to send:",
          "",
          "> ",
        ]);

        // Move cursor to the end
        await denops.cmd("normal! G$");

        state.prompt_buffer = bufnr;

        console.log("[claudecode] Prompt buffer opened");
      } catch (error) {
        console.error("[claudecode] Failed to open prompt buffer:", error);
        await denops.call("claudecode#handle_error", error);
      }
    },

    // Send message to Claude Code
    async sendMessage(message: unknown): Promise<void> {
      const msg = ensureString(message);

      if (!state.running) {
        await denops.call("claudecode#handle_error", "Server is not running");
        return;
      }

      try {
        // TODO: Implement Claude Code SDK integration
        console.log("[claudecode] Sending message:", msg);

        // Placeholder for actual Claude Code SDK integration
        await denops.call(
          "claudecode#show_message",
          "Message sent (placeholder)",
        );
      } catch (error) {
        console.error("[claudecode] Failed to send message:", error);
        await denops.call("claudecode#handle_error", error);
      }
    },

    // Get current selection for MCP tools
    async getSelection(): Promise<object> {
      try {
        const mode = await denops.call("mode") as string;
        const isVisual = mode === "v" || mode === "V" || mode === "";

        if (!isVisual) {
          return {};
        }

        const start = await denops.call("getpos", "'<") as number[];
        const end = await denops.call("getpos", "'>") as number[];
        const filename = await denops.call("expand", "%:p") as string;

        return {
          filename,
          start: { line: start[1], col: start[2] },
          end: { line: end[1], col: end[2] },
        };
      } catch (error) {
        console.error("[claudecode] Failed to get selection:", error);
        return {};
      }
    },

    // Open file with selection (MCP openFile tool)
    async openFile(filepath: unknown, options: unknown = {}): Promise<void> {
      const file = ensureString(filepath);
      const opts = ensureObject(options);

      try {
        await denops.cmd(`edit ${file}`);

        // TODO: Implement selection handling based on options
        console.log("[claudecode] Opened file:", file, "with options:", opts);
      } catch (error) {
        console.error("[claudecode] Failed to open file:", error);
        await denops.call("claudecode#handle_error", error);
      }
    },

    // Auto start functionality
    async autoStart(): Promise<void> {
      const config = await getConfig(denops);
      if (config.auto_start && !state.running) {
        await denops.dispatcher.start();
      }
    },
  };

  console.log("[claudecode] Plugin initialized");
}

// Helper functions

async function getConfig(denops: Denops): Promise<ClaudeCodeConfig> {
  try {
    const config = await variable.g.get(
      denops,
      "claudecode_config",
      {},
    ) as Partial<ClaudeCodeConfig>;

    // Merge with defaults
    return {
      port_range: config.port_range || { min: 10000, max: 65535 },
      auto_start: config.auto_start !== false,
      log_level: config.log_level || "info",
      auth_required: config.auth_required !== false,
      prompt_buffer: {
        split_direction: config.prompt_buffer?.split_direction || "vertical",
        size: config.prompt_buffer?.size || 80,
      },
    };
  } catch {
    // Return defaults if config is not available
    return {
      port_range: { min: 10000, max: 65535 },
      auto_start: true,
      log_level: "info",
      auth_required: true,
      prompt_buffer: {
        split_direction: "vertical",
        size: 80,
      },
    };
  }
}

function findAvailablePort(
  range: { min: number; max: number },
): Promise<number | null> {
  return new Promise((resolve) => {
    for (let port = range.min; port <= range.max; port++) {
      try {
        const listener = Deno.listen({ port, hostname: "127.0.0.1" });
        listener.close();
        resolve(port);
        return;
      } catch {
        // Port is in use, try next one
        continue;
      }
    }
    resolve(null);
  });
}

async function createLockFile(port: number, authToken: string): Promise<void> {
  try {
    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
    if (!homeDir) {
      throw new Error("Could not determine home directory");
    }

    const claudeDir = join(homeDir, ".claude", "ide");
    const lockFile = join(claudeDir, `${port}.lock`);

    // Ensure directory exists
    await Deno.mkdir(claudeDir, { recursive: true });

    // Create lock file
    const lockData = {
      pid: Deno.pid,
      workspaceFolders: [Deno.cwd()],
      ideName: "Vim/Neovim (denops)",
      transport: "ws",
      authToken,
    };

    await Deno.writeTextFile(lockFile, JSON.stringify(lockData, null, 2));
  } catch (error) {
    console.error("[claudecode] Failed to create lock file:", error);
  }
}

async function removeLockFile(port: number): Promise<void> {
  try {
    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
    if (!homeDir) {
      return;
    }

    const lockFile = join(homeDir, ".claude", "ide", `${port}.lock`);

    if (await exists(lockFile)) {
      await Deno.remove(lockFile);
    }
  } catch (error) {
    console.error("[claudecode] Failed to remove lock file:", error);
  }
}

function handleWebSocketRequest(request: Request): Response {
  const upgrade = request.headers.get("upgrade");
  if (upgrade !== "websocket") {
    return new Response("Not a WebSocket request", { status: 400 });
  }

  // Check authentication
  const authHeader = request.headers.get("x-claude-code-ide-authorization");
  if (state.auth_token && authHeader !== state.auth_token) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Upgrade to WebSocket
  const { socket, response } = Deno.upgradeWebSocket(request);

  socket.onopen = () => {
    console.log("[claudecode] WebSocket connection opened");
  };

  socket.onmessage = (event) => {
    console.log("[claudecode] WebSocket message received:", event.data);
    // TODO: Implement MCP message handling
  };

  socket.onclose = () => {
    console.log("[claudecode] WebSocket connection closed");
  };

  socket.onerror = (error) => {
    console.error("[claudecode] WebSocket error:", error);
  };

  return response;
}
