import { Denops } from "jsr:@denops/std@^7.0.0";
import { ensure, is } from "jsr:@core/unknownutil@^4.0.0";
import { claude } from "npm:@instantlyeasy/claude-code-sdk-ts@0.3.0";
import type { Message } from "npm:@instantlyeasy/claude-code-sdk-ts@0.3.0";

export type Session = {
  id: string;
  model: string;
  bufnr: number;
  messages: Message[];
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
      const message = ensure(prompt, is.String);

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

        // Send message to Claude
        const response = await claude()
          .withModel(session.model)
          .allowTools(
            "Read",
            "Write",
            "Edit",
            "MultiEdit",
            "Grep",
            "LS",
            "Bash",
          )
          .acceptEdits()
          .query(message)
          .asText();

        // Update buffer with response
        await denops.call(
          "claudecode#buffer#replace_last_line",
          session.bufnr,
          "",
        );
        await denops.call(
          "claudecode#buffer#append_line",
          session.bufnr,
          "Claude:",
        );

        // Split response by lines and append each
        const lines = response.split("\n");
        for (const line of lines) {
          await denops.call(
            "claudecode#buffer#append_line",
            session.bufnr,
            line,
          );
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
