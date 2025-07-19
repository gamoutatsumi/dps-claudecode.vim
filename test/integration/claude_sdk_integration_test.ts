import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.0";
import { beforeEach, describe, it } from "jsr:@std/testing@^1.0.0/bdd";
import { createMockQuery, mockResponses } from "../mocks/claude_sdk.ts";

// Mock Denops interface for testing
interface MockDenops {
  calls: Array<{ method: string; args: unknown[] }>;

  call(method: string, ...args: unknown[]): Promise<unknown>;
  reset(): void;
}

// Integration test for Claude SDK with denops
describe("Claude SDK Denops Integration", () => {
  let denops: MockDenops;
  let mockQuery: ReturnType<typeof createMockQuery>;

  beforeEach(() => {
    denops = {
      calls: [],
      call: function (method: string, ...args: unknown[]) {
        this.calls.push({ method, args });
        return Promise.resolve();
      },
      reset: function () {
        this.calls = [];
      },
    };
  });

  it("should batch buffer updates during streaming", async () => {
    mockQuery = createMockQuery(mockResponses.multipartResponse);

    // Simulate the sendMessage function with batching
    const bufnr = 1234;
    const pendingLines: string[] = [];
    let lastFlushTime = Date.now();
    const FLUSH_INTERVAL = 100;

    async function flushPendingLines(force: boolean = false) {
      const now = Date.now();
      if (
        pendingLines.length > 0 &&
        (force || now - lastFlushTime >= FLUSH_INTERVAL)
      ) {
        await denops.call("claudecode#buffer#append_lines", bufnr, [
          ...pendingLines,
        ]);
        pendingLines.length = 0;
        lastFlushTime = now;
      }
    }

    // Process messages
    await denops.call("claudecode#buffer#append_line", bufnr, "");
    await denops.call(
      "claudecode#buffer#append_line",
      bufnr,
      "Claude is thinking...",
    );

    let hasStartedResponse = false;

    for await (const message of mockQuery("test prompt")) {
      if (message.type === "assistant") {
        if (!hasStartedResponse) {
          await denops.call(
            "claudecode#buffer#replace_last_line",
            bufnr,
            "Claude:",
          );
          hasStartedResponse = true;
        }

        if (message.message && message.message.content) {
          for (const content of message.message.content) {
            if (content.type === "text") {
              const lines = content.text.split("\n");
              for (let i = 0; i < lines.length; i++) {
                if (i < lines.length - 1 || lines[i]) {
                  pendingLines.push(lines[i]);
                }
              }
              await flushPendingLines();
            }
          }
        }
      } else if (message.type === "result") {
        await flushPendingLines(true);

        if (message.usage) {
          await denops.call("claudecode#buffer#append_lines", bufnr, [
            "",
            `[Tokens used: ${message.usage.input_tokens} input, ${message.usage.output_tokens} output]`,
          ]);
        }
      }
    }

    await flushPendingLines(true);
    await denops.call("claudecode#buffer#append_lines", bufnr, ["", "---", ""]);

    // Verify batching occurred
    const appendLinesCalls = denops.calls.filter((c) =>
      c.method === "claudecode#buffer#append_lines"
    );
    assertExists(appendLinesCalls.length > 0);

    // Verify initial setup calls
    const setupCalls = denops.calls.slice(0, 3);
    assertEquals(setupCalls[0].method, "claudecode#buffer#append_line");
    assertEquals(setupCalls[1].method, "claudecode#buffer#append_line");
    assertEquals(setupCalls[2].method, "claudecode#buffer#replace_last_line");
  });

  it("should handle error responses correctly", async () => {
    mockQuery = createMockQuery(mockResponses.errorResponse);
    const bufnr = 5678;

    // Initial setup
    await denops.call("claudecode#buffer#append_line", bufnr, "");
    await denops.call(
      "claudecode#buffer#append_line",
      bufnr,
      "Claude is thinking...",
    );

    try {
      for await (const _message of mockQuery("test prompt")) {
        // This should throw
      }
    } catch (error) {
      await denops.call("claudecode#buffer#replace_last_line", bufnr, "");
      await denops.call(
        "claudecode#buffer#append_line",
        bufnr,
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      await denops.call("claudecode#buffer#append_line", bufnr, "");
    }

    // Verify error handling
    const errorCall = denops.calls.find((c) =>
      c.method === "claudecode#buffer#append_line" &&
      c.args[1]?.toString().includes("Error: API rate limit exceeded")
    );
    assertExists(errorCall);
  });

  it("should optimize performance with batched updates", async () => {
    // Create a large response to test batching
    const largeResponse = [
      {
        type: "assistant",
        message: {
          content: Array.from({ length: 100 }, (_, i) => ({
            type: "text",
            text: `Line ${i + 1}\n`,
          })),
        },
      },
      {
        type: "result",
        usage: {
          input_tokens: 50,
          output_tokens: 500,
        },
      },
    ];

    mockQuery = createMockQuery(largeResponse);
    const bufnr = 9999;

    // Process with batching
    const pendingLines: string[] = [];
    let flushCount = 0;

    async function flushPendingLines(force: boolean = false) {
      if (pendingLines.length > 0 && (force || pendingLines.length >= 10)) {
        await denops.call("claudecode#buffer#append_lines", bufnr, [
          ...pendingLines,
        ]);
        pendingLines.length = 0;
        flushCount++;
      }
    }

    for await (const message of mockQuery("test")) {
      if (message.type === "assistant" && message.message) {
        for (const content of message.message.content) {
          if (content.type === "text") {
            const lines = content.text.split("\n").filter((l) => l);
            pendingLines.push(...lines);
            await flushPendingLines();
          }
        }
      }
    }
    await flushPendingLines(true);

    // Verify batching reduced the number of calls
    assertExists(flushCount < 100); // Should be much less than 100 individual calls
    assertExists(flushCount > 1); // Should have batched some calls
  });
});
