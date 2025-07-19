import { Denops } from "jsr:@denops/std@^7.0.0";
import { ensure, is } from "jsr:@core/unknownutil@^4.0.0";
import { query } from "npm:@anthropic-ai/claude-code@1.0.51";

// Define types based on stream.json format
interface TextContent {
  type: "text";
  text: string;
}

interface AssistantMessage {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: TextContent[];
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens: number;
    service_tier: string;
  };
}

interface StreamMessage {
  type: "system" | "assistant" | "result";
  message?: AssistantMessage;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  // Other fields we don't need to track
  [key: string]: unknown;
}

export type Session = {
  id: string;
  model: string;
  bufnr: number;
  messages: AssistantMessage[];
  active: boolean;
};

const sessions = new Map<string, Session>();

export function main(denops: Denops): void {
  denops.dispatcher = {
    startSession(bufnr: unknown, model?: unknown): string {
      const bufferNumber = ensure(bufnr, is.Number);
      const modelName = model ? ensure(model, is.String) : "sonnet";

      const sessionId = crypto.randomUUID();
      const session: Session = {
        id: sessionId,
        model: modelName,
        bufnr: bufferNumber,
        messages: [],
        active: true,
      };

      sessions.set(sessionId, session);
      return sessionId;
    },

    async sendMessage(sessionId: unknown, prompt: unknown): Promise<void> {
      const id = ensure(sessionId, is.String);
      const promptStr = ensure(prompt, is.String);

      const session = sessions.get(id);
      if (!session || !session.active) {
        throw new Error(`Session ${id} not found or inactive`);
      }

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
          const message = rawMessage as StreamMessage;
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
                  // Split by lines and append each line to buffer
                  const lines = content.text.split("\n");
                  for (let i = 0; i < lines.length; i++) {
                    // Don't append the last empty line from split
                    if (i < lines.length - 1 || lines[i]) {
                      await denops.call(
                        "claudecode#buffer#append_line",
                        session.bufnr,
                        lines[i],
                      );
                    }
                  }
                }
              }
            }

            // Store the message in session
            if (message.message) {
              session.messages.push(message.message);
            }
          } else if (message.type === "result") {
            // Handle final result with usage statistics if needed
            if (message.usage) {
              await denops.call(
                "claudecode#buffer#append_line",
                session.bufnr,
                "",
              );
              await denops.call(
                "claudecode#buffer#append_line",
                session.bufnr,
                `[Tokens used: ${message.usage.input_tokens} input, ${message.usage.output_tokens} output]`,
              );
            }
          }
        }

        await denops.call("claudecode#buffer#append_line", session.bufnr, "");
        await denops.call(
          "claudecode#buffer#append_line",
          session.bufnr,
          "---",
        );
        await denops.call("claudecode#buffer#append_line", session.bufnr, "");
      } catch (error) {
        await denops.call(
          "claudecode#buffer#replace_last_line",
          session.bufnr,
          "",
        );
        await denops.call(
          "claudecode#buffer#append_line",
          session.bufnr,
          `Error: ${error instanceof Error ? error.message : String(error)}`,
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
      }
    },

    listSessions(): string[] {
      return Array.from(sessions.keys());
    },

    getSessionInfo(sessionId: unknown): Session | null {
      const id = ensure(sessionId, is.String);
      return sessions.get(id) || null;
    },

    async switchModel(sessionId: unknown, model: unknown): Promise<void> {
      const id = ensure(sessionId, is.String);
      const modelName = ensure(model, is.String);

      const session = sessions.get(id);
      if (!session) {
        throw new Error(`Session ${id} not found`);
      }
      if (!session.active) {
        throw new Error(`Session ${id} is inactive`);
      }

      session.model = modelName;
      await denops.call(
        "claudecode#buffer#append_line",
        session.bufnr,
        `Switched to model: ${modelName}`,
      );
      await denops.call("claudecode#buffer#append_line", session.bufnr, "");
    },
  };
}
