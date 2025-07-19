import { assertEquals, assertRejects } from "jsr:@std/assert@^1.0.0";
import { DenopsStub } from "jsr:@denops/test@^3.0.4";
import { describe, it } from "jsr:@std/testing@^1.0.0/bdd";
import { ensure, is } from "jsr:@core/unknownutil@^4.3.0";

// Define type predicates for better readability
const isSessionInfoPartial = is.ObjectOf({ model: is.String });
const isSessionInfoPartialOrNull = is.UnionOf([isSessionInfoPartial, is.Null]);
const isTextOrTextArray = is.UnionOf([is.String, is.ArrayOf(is.String)]);
const isNumberOrString = is.UnionOf([is.Number, is.String]);

describe("Denops Plugin with Stub", () => {
  it("should handle dispatcher calls correctly", async () => {
    // Create a stub with custom dispatch implementation
    const denops = new DenopsStub({
      name: "claudecode",
      dispatch: (_name: string, method: string, args: unknown[]) => {
        if (method === "startSession") {
          return Promise.resolve("test-session-id");
        } else if (method === "getSessionInfo") {
          const [sessionId] = args;
          if (ensure(sessionId, is.String) === "test-session-id") {
            return Promise.resolve({
              id: "test-session-id",
              model: "sonnet",
              bufnr: 1,
              messages: [],
              active: true,
            });
          }
          return Promise.resolve(null);
        } else if (method === "getCurrentSession") {
          return Promise.resolve("test-session-id");
        } else if (method === "listSessions") {
          return Promise.resolve(["test-session-id"]);
        }

        return Promise.resolve(null);
      },
    });

    // Test dispatcher methods
    const sessionId = await denops.dispatch("claudecode", "startSession", [
      1,
      "sonnet",
    ]);
    assertEquals(sessionId, "test-session-id");

    const infoResult = await denops.dispatch("claudecode", "getSessionInfo", [
      "test-session-id",
    ]);
    const info = ensure(infoResult, isSessionInfoPartialOrNull);
    assertEquals(info?.model, "sonnet");

    const current = await denops.dispatch(
      "claudecode",
      "getCurrentSession",
      [],
    );
    assertEquals(current, "test-session-id");

    const sessions = await denops.dispatch("claudecode", "listSessions", []);
    assertEquals(sessions, ["test-session-id"]);
  });

  it("should handle Vim function calls", async () => {
    const mockBuffers: Record<number, string[]> = {
      1: ["Line 1", "Line 2", "Line 3"],
    };

    const denops = new DenopsStub({
      call: (fn: string, ...args: unknown[]) => {
        switch (fn) {
          case "bufnr":
            return Promise.resolve(1);
          case "bufname":
            return Promise.resolve(`ClaudeCode-${args[0]}`);
          case "getbufline": {
            const [bufnr, start, end] = args;
            const bufnrNum = ensure(bufnr, is.Number);
            const startNum = ensure(start, isNumberOrString);
            const endVal = ensure(end, isNumberOrString);
            const lines = mockBuffers[bufnrNum] || [];
            if (endVal === "$") {
              return Promise.resolve(lines.slice((startNum as number) - 1));
            }
            return Promise.resolve(
              lines.slice((startNum as number) - 1, endVal as number),
            );
          }
          case "setline": {
            const [lnum, text] = args;
            const lineNum = ensure(lnum, is.Number);
            const textStr = ensure(text, is.String);
            const bufnr = 1; // Assume current buffer
            if (mockBuffers[bufnr]) {
              mockBuffers[bufnr][lineNum - 1] = textStr;
            }
            return Promise.resolve(0);
          }
          case "append": {
            const [lnum, text] = args;
            const lineNum = ensure(lnum, is.Number);
            const textVal = ensure(text, isTextOrTextArray);
            const bufnr = 1;
            const lines = Array.isArray(textVal) ? textVal : [textVal];
            if (mockBuffers[bufnr]) {
              mockBuffers[bufnr].splice(lineNum, 0, ...lines);
            }
            return Promise.resolve(0);
          }
          default:
            return Promise.reject(new Error(`Unknown function: ${fn}`));
        }
      },
    });

    // Test buffer operations
    const bufnr = await denops.call("bufnr", "%");
    assertEquals(bufnr, 1);

    const bufname = await denops.call("bufname", bufnr);
    assertEquals(bufname, "ClaudeCode-1");

    const lines = await denops.call("getbufline", bufnr, 1, "$");
    assertEquals(lines, ["Line 1", "Line 2", "Line 3"]);

    await denops.call("setline", 2, "Modified Line 2");
    const modifiedLines = await denops.call("getbufline", bufnr, 2, 2);
    assertEquals(modifiedLines, ["Modified Line 2"]);

    await denops.call("append", 1, "Inserted Line");
    const allLines = await denops.call("getbufline", bufnr, 1, "$");
    assertEquals(allLines, [
      "Line 1",
      "Inserted Line",
      "Modified Line 2",
      "Line 3",
    ]);
  });

  it("should handle errors appropriately", async () => {
    const denops = new DenopsStub({
      dispatch: (_name: string, method: string) => {
        if (method === "errorMethod") {
          throw new Error("Test error");
        }
        return Promise.resolve(null);
      },
    });

    await assertRejects(
      async () => {
        await denops.dispatch("claudecode", "errorMethod", []);
      },
      Error,
      "Test error",
    );
  });

  it("should support batch operations", async () => {
    const denops = new DenopsStub({});

    // Batch operations compile multiple commands for efficiency
    // With DenopsStub, we just ensure the method exists and doesn't throw
    const batch1 = denops.batch(["call", "func1"]);
    const batch2 = denops.batch(["call", "func2"]);
    const batch3 = denops.batch(["call", "func3"]);

    // Ensure batch operations return promises
    assertEquals(batch1 instanceof Promise, true);
    assertEquals(batch2 instanceof Promise, true);
    assertEquals(batch3 instanceof Promise, true);

    // Wait for all batches to complete
    await Promise.all([batch1, batch2, batch3]);
  });

  it("should handle command execution", async () => {
    const executedCommands: string[] = [];

    const denops = new DenopsStub({
      cmd: (cmd: string) => {
        executedCommands.push(cmd);
        return Promise.resolve();
      },
    });

    await denops.cmd("edit test.txt");
    await denops.cmd("set number");
    await denops.cmd("write");

    assertEquals(executedCommands, ["edit test.txt", "set number", "write"]);
  });

  it("should handle eval operations", async () => {
    const denops = new DenopsStub({
      eval: (expr: string) => {
        switch (expr) {
          case "&filetype":
            return Promise.resolve("typescript");
          case "line('.')":
            return Promise.resolve(42);
          case "expand('%:p')":
            return Promise.resolve("/path/to/file.ts");
          default:
            return Promise.resolve(null);
        }
      },
    });

    const filetype = await denops.eval("&filetype");
    assertEquals(filetype, "typescript");

    const currentLine = await denops.eval("line('.')");
    assertEquals(currentLine, 42);

    const fullPath = await denops.eval("expand('%:p')");
    assertEquals(fullPath, "/path/to/file.ts");
  });
});
