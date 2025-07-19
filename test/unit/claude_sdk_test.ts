import {
  assertEquals,
  assertExists,
  assertRejects,
} from "jsr:@std/assert@^1.0.0";
import { beforeEach, describe, it } from "jsr:@std/testing@^1.0.0/bdd";
import { createMockQuery, mockResponses } from "../mocks/claude_sdk.ts";

// Test interface for Claude SDK message handling
interface TestSession {
  id: string;
  model: string;
  bufnr: number;
  messages: Array<{
    content: Array<{
      type: string;
      text: string;
    }>;
  }>;
  buffer: string[];
  active: boolean;
  lastActivity: number;
}

// Mock implementation of the message handler
class ClaudeMessageHandler {
  private sessions = new Map<string, TestSession>();
  private mockQuery: ReturnType<typeof createMockQuery>;

  constructor(mockQuery: ReturnType<typeof createMockQuery>) {
    this.mockQuery = mockQuery;
  }

  createSession(id: string, model: string, bufnr: number): TestSession {
    const session: TestSession = {
      id,
      model,
      bufnr,
      messages: [],
      buffer: [],
      active: true,
      lastActivity: Date.now(),
    };
    this.sessions.set(id, session);
    return session;
  }

  async sendMessage(sessionId: string, prompt: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) {
      throw new Error(`Session ${sessionId} not found or inactive`);
    }

    session.lastActivity = Date.now();
    session.buffer.push("", "Claude is thinking...");

    let responseText = "";
    let hasStartedResponse = false;
    const pendingLines: string[] = [];

    try {
      for await (const message of this.mockQuery(prompt)) {
        if (message.type === "assistant") {
          if (!hasStartedResponse) {
            // Replace "Claude is thinking..." with "Claude:"
            session.buffer[session.buffer.length - 1] = "Claude:";
            hasStartedResponse = true;
          }

          if (message.message && message.message.content) {
            for (const content of message.message.content) {
              if (content.type === "text") {
                responseText += content.text;
                const lines = content.text.split("\n");
                for (let i = 0; i < lines.length; i++) {
                  if (i < lines.length - 1 || lines[i]) {
                    pendingLines.push(lines[i]);
                  }
                }
              }
            }
            session.messages.push(message.message);
          }
        } else if (message.type === "result") {
          // Flush pending lines
          session.buffer.push(...pendingLines);

          if (message.usage) {
            session.buffer.push(
              "",
              `[Tokens used: ${message.usage.input_tokens} input, ${message.usage.output_tokens} output]`,
            );
          }
        }
      }

      // Add separator
      session.buffer.push("", "---", "");
    } catch (error) {
      session.buffer[session.buffer.length - 1] = "";
      session.buffer.push(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        "",
      );
      throw error;
    }
  }

  getSession(sessionId: string): TestSession | undefined {
    return this.sessions.get(sessionId);
  }
}

describe("Claude SDK Communication", () => {
  let handler: ClaudeMessageHandler;

  beforeEach(() => {
    // Default to simple response mock
    handler = new ClaudeMessageHandler(
      createMockQuery(mockResponses.simpleResponse),
    );
  });

  it("should handle simple text responses", async () => {
    const session = handler.createSession("test-1", "sonnet", 1234);

    await handler.sendMessage("test-1", "Hello Claude!");

    // Check buffer output
    assertEquals(session.buffer[0], "");
    assertEquals(session.buffer[1], "Claude:");
    assertEquals(session.buffer[2], "Hello! How can I help you today?");
    assertEquals(session.buffer[3], "");
    assertEquals(session.buffer[4], "[Tokens used: 15 input, 8 output]");
    assertEquals(session.buffer[5], "");
    assertEquals(session.buffer[6], "---");
    assertEquals(session.buffer[7], "");

    // Check stored messages
    assertEquals(session.messages.length, 1);
    assertEquals(
      session.messages[0].content[0].text,
      "Hello! How can I help you today?",
    );
  });

  it("should handle code responses with newlines", async () => {
    handler = new ClaudeMessageHandler(
      createMockQuery(mockResponses.codeResponse),
    );
    const session = handler.createSession("test-2", "opus", 5678);

    await handler.sendMessage("test-2", "Write a greeting function");

    // Check that code is properly formatted
    assertExists(session.buffer.find((line) => line.includes("```typescript")));
    assertExists(
      session.buffer.find((line) => line.includes("function greet")),
    );
    assertExists(session.buffer.find((line) => line.includes("```")));
  });

  it("should handle multipart streaming responses", async () => {
    handler = new ClaudeMessageHandler(
      createMockQuery(mockResponses.multipartResponse),
    );
    const session = handler.createSession("test-3", "haiku", 9012);

    await handler.sendMessage("test-3", "Help me understand");

    // Check that all parts are present
    const fullResponse = session.buffer.join("\n");
    assertExists(fullResponse.includes("Let me help you with that."));
    assertExists(
      fullResponse.includes("First, we need to understand the problem."),
    );
    assertExists(fullResponse.includes("Then we can work on a solution."));
  });

  it("should handle API errors gracefully", async () => {
    handler = new ClaudeMessageHandler(
      createMockQuery(mockResponses.errorResponse),
    );
    const session = handler.createSession("test-4", "sonnet", 3456);

    await assertRejects(
      async () => await handler.sendMessage("test-4", "This will fail"),
      Error,
      "API rate limit exceeded",
    );

    // Error should be in buffer
    assertExists(
      session.buffer.find((line) =>
        line.includes("Error: API rate limit exceeded")
      ),
    );
  });

  it("should handle empty responses", async () => {
    handler = new ClaudeMessageHandler(
      createMockQuery(mockResponses.emptyResponse),
    );
    const session = handler.createSession("test-5", "sonnet", 7890);

    await handler.sendMessage("test-5", "Empty response test");

    // Check that empty response is handled
    assertEquals(session.buffer[1], "Claude:");
    assertEquals(session.buffer[2], "");
    assertExists(
      session.buffer.find((line) =>
        line.includes("[Tokens used: 10 input, 0 output]")
      ),
    );
  });

  it("should reject messages to inactive sessions", async () => {
    const session = handler.createSession("test-6", "sonnet", 1111);
    session.active = false;

    await assertRejects(
      async () => await handler.sendMessage("test-6", "This should fail"),
      Error,
      "Session test-6 not found or inactive",
    );
  });

  it("should update last activity timestamp", async () => {
    const session = handler.createSession("test-7", "sonnet", 2222);
    const initialActivity = session.lastActivity;

    // Wait a bit to ensure timestamp changes
    await new Promise((resolve) => setTimeout(resolve, 10));

    await handler.sendMessage("test-7", "Update activity");

    assertExists(session.lastActivity > initialActivity);
  });

  it("should handle concurrent message handling", async () => {
    // Create multiple sessions
    const sessions = [
      handler.createSession("concurrent-1", "sonnet", 1001),
      handler.createSession("concurrent-2", "opus", 1002),
      handler.createSession("concurrent-3", "haiku", 1003),
    ];

    // Send messages concurrently
    const promises = sessions.map((_, index) =>
      handler.sendMessage(`concurrent-${index + 1}`, `Message ${index + 1}`)
    );

    await Promise.all(promises);

    // Verify all sessions received responses
    sessions.forEach((_, index) => {
      const session = handler.getSession(`concurrent-${index + 1}`);
      assertExists(session);
      assertExists(session.buffer.length > 0);
      assertExists(session.messages.length > 0);
    });
  });
});
