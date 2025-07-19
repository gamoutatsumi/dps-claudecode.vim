import * as path from "jsr:@std/path@1.0.0";
import { test as testOri, type TestDefinition } from "jsr:@denops/test@^3.0.4";
import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.0";
import { ensure, is } from "jsr:@core/unknownutil@^4.3.0";

// Define type predicates for better readability
const isSessionInfo = is.ObjectOf({
  model: is.String,
  bufnr: is.Number,
  active: is.Boolean,
});

const isSessionInfoOrNull = is.UnionOf([isSessionInfo, is.Null]);

const runtimePath = path.resolve(
  path.fromFileUrl(new URL("../..", import.meta.url)),
);

const test = (
  mode: TestDefinition["mode"],
  name: string,
  fn: TestDefinition["fn"],
) =>
  testOri({
    mode,
    name,
    fn,
    pluginName: "claudecode",
    prelude: [`set runtimepath^=${runtimePath}`],
  });

test(
  "all",
  "Denops dispatcher functions",
  async (denops, t) => {
    await t.step({
      name: "Session API",
      fn: async () => {
        // Test session creation
        const sessionId = await denops.dispatch(denops.name, "startSession", [
          1,
          "sonnet",
        ]);
        assertExists(sessionId);
        assertEquals(typeof sessionId, "string");

        // Test getting session info
        const info = await denops.dispatch(denops.name, "getSessionInfo", [
          sessionId,
        ]);
        const sessionInfo = ensure(info, isSessionInfoOrNull);
        assertExists(sessionInfo);
        assertEquals(sessionInfo.model, "sonnet");
        assertEquals(sessionInfo.bufnr, 1);
        assertEquals(sessionInfo.active, true);

        // Test getting current session
        const currentSession = await denops.dispatch(
          denops.name,
          "getCurrentSession",
          [],
        );
        assertEquals(currentSession, sessionId);

        // Test listing sessions
        const sessionsResult = await denops.dispatch(
          denops.name,
          "listSessions",
          [],
        );
        const sessions = ensure(sessionsResult, is.ArrayOf(is.String));
        assertEquals(Array.isArray(sessions), true);
        assertEquals(sessions.includes(ensure(sessionId, is.String)), true);

        // Test ending session
        await denops.dispatch(denops.name, "endSession", [sessionId]);

        // Verify session is ended
        const endedInfo = await denops.dispatch(denops.name, "getSessionInfo", [
          sessionId,
        ]);
        assertEquals(endedInfo, null);

        const endedCurrent = await denops.dispatch(
          denops.name,
          "getCurrentSession",
          [],
        );
        assertEquals(endedCurrent, null);
      },
    });
  },
);

test(
  "all",
  "State management centralization",
  async (denops) => {
    // Create multiple sessions
    const session1 = await denops.dispatch(denops.name, "startSession", [
      1,
      "sonnet",
    ]);
    const session2 = await denops.dispatch(denops.name, "startSession", [
      2,
      "opus",
    ]);

    // Current session should be the last created one
    let current = await denops.dispatch(denops.name, "getCurrentSession", []);
    assertEquals(current, session2);

    // Test session switching
    await denops.dispatch(denops.name, "setCurrentSession", [session1]);
    current = await denops.dispatch(denops.name, "getCurrentSession", []);
    assertEquals(current, session1);

    // Test getting all sessions
    const allSessionsResult = await denops.dispatch(
      denops.name,
      "getAllSessions",
      [],
    );
    const allSessions = ensure(allSessionsResult, is.RecordOf(is.Unknown));
    assertEquals(Object.keys(allSessions).length, 2);
    assertExists(allSessions[ensure(session1, is.String)]);
    assertExists(allSessions[ensure(session2, is.String)]);

    // Clean up
    await denops.dispatch(denops.name, "endSession", [session1]);
    await denops.dispatch(denops.name, "endSession", [session2]);
  },
);

test(
  "all",
  "Error handling",
  async (denops) => {
    // Test setting non-existent session as current
    try {
      await denops.dispatch(denops.name, "setCurrentSession", [
        "non-existent-id",
      ]);
      // Should not reach here
      assertEquals(true, false, "Expected error was not thrown");
    } catch (error) {
      assertExists(error);
      const errorObj = ensure(error, is.InstanceOf(Error));
      assertEquals(errorObj.message.includes("not found"), true);
    }

    // Test sending message without active session
    try {
      await denops.dispatch(denops.name, "sendMessage", [
        "non-existent-id",
        "Hello",
      ]);
      assertEquals(true, false, "Expected error was not thrown");
    } catch (error) {
      assertExists(error);
    }
  },
);

// Test with Vim only
test(
  "vim",
  "Vim-specific buffer operations",
  async (denops) => {
    const sessionId = await denops.dispatch(denops.name, "startSession", [
      1,
      "sonnet",
    ]);

    // Test buffer name pattern
    const bufname = await denops.call("bufname", 1);
    assertEquals(typeof bufname, "string");

    // Clean up
    await denops.dispatch(denops.name, "endSession", [sessionId]);
  },
);

// Test with Neovim only
test(
  "nvim",
  "Neovim-specific features",
  async (denops) => {
    const sessionId = await denops.dispatch(denops.name, "startSession", [
      1,
      "sonnet",
    ]);

    // Test nvim-specific functionality if needed
    const hasNvim = await denops.call("has", "nvim");
    assertEquals(hasNvim, 1);

    // Clean up
    await denops.dispatch(denops.name, "endSession", [sessionId]);
  },
);
