import type { Denops, Entrypoint } from "jsr:@denops/std@^7.6.0";
import { ensure, is } from "jsr:@core/unknownutil@^4.3.0";
import { query } from "npm:@anthropic-ai/claude-code@^1.0.56";
import { Session } from "./types.ts";

// Function to sanitize error messages
function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(
      /api[_-]?key|token|secret|auth|bearer/gi,
      "[REDACTED]",
    );
  }
  return String(error).replace(
    /api[_-]?key|token|secret|auth|bearer/gi,
    "[REDACTED]",
  );
}

const FLUSH_INTERVAL = 100; // Flush every 100ms

const sessions = new Map<string, Session>();
let currentSessionId: string | null = null;

// Memory management constants
const MAX_SESSIONS = 10;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Cleanup inactive sessions
function cleanupInactiveSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (!session.active || (now - session.lastActivity > SESSION_TIMEOUT)) {
      sessions.delete(id);
      if (currentSessionId === id) {
        currentSessionId = null;
      }
    }
  }
}

// Helper function to flush pending lines
async function flushPendingLines(
  denops: Denops,
  pendingLines: string[],
  session: Session,
  lastFlushTime: number,
  force: boolean = false,
): Promise<number | null> {
  const now = Date.now();
  if (
    pendingLines.length > 0 &&
    (force || now - lastFlushTime >= FLUSH_INTERVAL)
  ) {
    await denops.call(
      "claudecode#buffer#append_lines",
      session.bufnr,
      pendingLines,
    );
    return now;
  }
  return null;
}

export const main: Entrypoint = (denops) => {
  denops.dispatcher = {
    startSession(bufnr: unknown, model?: unknown): string {
      const bufferNumber = ensure(bufnr, is.Number);
      const modelName = model ? ensure(model, is.String) : "sonnet";

      // Clean up inactive sessions before creating a new one
      cleanupInactiveSessions();

      // Check if we've reached the maximum number of sessions
      if (sessions.size >= MAX_SESSIONS) {
        throw new Error(
          `Maximum number of sessions (${MAX_SESSIONS}) reached. Please close some sessions before starting a new one.`,
        );
      }

      const sessionId = crypto.randomUUID();
      const session: Session = {
        id: sessionId,
        model: modelName,
        bufnr: bufferNumber,
        messages: [],
        active: true,
        lastActivity: Date.now(),
      };

      sessions.set(sessionId, session);
      currentSessionId = sessionId;
      return sessionId;
    },

    async sendMessage(sessionId: unknown, prompt: unknown): Promise<void> {
      const id = ensure(sessionId, is.String);
      const promptStr = ensure(prompt, is.String);

      const session = sessions.get(id);
      if (!session || !session.active) {
        throw new Error(`Session ${id} not found or inactive`);
      }

      // Update last activity timestamp
      session.lastActivity = Date.now();

      try {
        // Update buffer to show processing
        await denops.call("claudecode#buffer#append_line", session.bufnr, "");
        await denops.call(
          "claudecode#buffer#append_line",
          session.bufnr,
          "Claude is thinking...",
        );

        let responseText = "";
        let hasStartedResponse = false;
        let pendingLines: string[] = [];
        let lastFlushTime = Date.now();

        // Send message to Claude
        for await (
          const rawMessage of query({
            prompt: promptStr,
            abortController: new AbortController(),
            options: {
              maxTurns: 3,
              model: session.model,
            },
          })
        ) {
          const message = rawMessage;
          // Handle different message types based on stream.json format
          if (message.type === "assistant") {
            if (!hasStartedResponse) {
              // Replace "Claude is thinking..." with "Claude:"
              await denops.call(
                "claudecode#buffer#replace_last_line",
                session.bufnr,
                "Claude:",
              );
              hasStartedResponse = true;
            }

            // Extract text content from assistant message
            if (message.message && message.message.content) {
              for (const content of message.message.content) {
                if (content.type === "text") {
                  responseText += content.text;
                  // Split by lines and batch them
                  const lines = content.text.split("\n");
                  for (let i = 0; i < lines.length; i++) {
                    // Don't append the last empty line from split
                    if (i < lines.length - 1 || lines[i]) {
                      pendingLines.push(lines[i]);
                    }
                  }
                  // Flush periodically
                  const flushRes = await flushPendingLines(
                    denops,
                    pendingLines,
                    session,
                    lastFlushTime,
                  );
                  if (flushRes !== null) {
                    lastFlushTime = flushRes;
                    pendingLines = []; // Clear after flushing
                  }
                }
              }
            }

            // Store the message in session
            if (message.message) {
              session.messages.push(message.message);
            }
          } else if (message.type === "result") {
            // Flush any remaining lines before showing usage
            const flushRes = await flushPendingLines(
              denops,
              pendingLines,
              session,
              lastFlushTime,
              true,
            );
            if (flushRes !== null) {
              lastFlushTime = flushRes;
              pendingLines = []; // Clear after flushing
            }

            // Handle final result with usage statistics if needed
            if (message.usage) {
              await denops.call(
                "claudecode#buffer#append_lines",
                session.bufnr,
                [
                  "",
                  `[Tokens used: ${message.usage.input_tokens} input, ${message.usage.output_tokens} output]`,
                ],
              );
            }
          }
        }

        // Flush any remaining lines
        const flushRes = await flushPendingLines(
          denops,
          pendingLines,
          session,
          lastFlushTime,
          true,
        );
        if (flushRes !== null) {
          lastFlushTime = flushRes;
          pendingLines = []; // Clear after flushing
        }

        // Add separator
        await denops.call(
          "claudecode#buffer#append_lines",
          session.bufnr,
          ["", "---", ""],
        );
      } catch (error) {
        await denops.call(
          "claudecode#buffer#replace_last_line",
          session.bufnr,
          "",
        );
        await denops.call(
          "claudecode#buffer#append_line",
          session.bufnr,
          `Error: ${sanitizeErrorMessage(error)}`,
        );
        await denops.call("claudecode#buffer#append_line", session.bufnr, "");
      }
    },

    endSession(sessionId: unknown): void {
      const id = ensure(sessionId, is.String);
      const session = sessions.get(id);

      if (session) {
        session.active = false;
        sessions.delete(id);

        // Clear current session if it's the one being ended
        if (currentSessionId === id) {
          currentSessionId = null;
        }
      }
    },

    listSessions(): string[] {
      return Array.from(sessions.keys());
    },

    getSessionInfo(sessionId: unknown): Session | null {
      const id = ensure(sessionId, is.String);
      return sessions.get(id) || null;
    },

    getCurrentSession(): string | null {
      return currentSessionId;
    },

    setCurrentSession(sessionId: unknown): void {
      const id = ensure(sessionId, is.String);

      // Verify the session exists and is active
      const session = sessions.get(id);
      if (!session) {
        throw new Error(`Session ${id} not found`);
      }
      if (!session.active) {
        throw new Error(`Session ${id} is inactive`);
      }

      // Update last activity timestamp
      session.lastActivity = Date.now();

      currentSessionId = id;
    },

    getSession(sessionId: unknown): Session | null {
      const id = ensure(sessionId, is.String);
      return sessions.get(id) || null;
    },

    getAllSessions(): Record<string, Session> {
      const result: Record<string, Session> = {};
      sessions.forEach((session, id) => {
        result[id] = session;
      });
      return result;
    },

    async switchModel(sessionId: unknown, model: unknown): Promise<void> {
      const id = ensure(sessionId, is.String);
      const modelName = ensure(model, is.String);

      const session = sessions.get(id);
      if (!session || !session.active) {
        throw new Error(`Session ${id} not found or inactive`);
      }

      // Update last activity timestamp
      session.lastActivity = Date.now();

      session.model = modelName;
      await denops.call(
        "claudecode#buffer#append_line",
        session.bufnr,
        `Switched to model: ${modelName}`,
      );
      await denops.call("claudecode#buffer#append_line", session.bufnr, "");
    },
  };
};
