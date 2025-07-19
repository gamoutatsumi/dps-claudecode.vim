# dps-claudecode.vim 実装計画

## 概要

このドキュメントは、denops.vimを使用してClaude
Code統合プラグインを実装するための詳細な計画を示します。既存のclaudecode.nvimの実装を参考にしながら、`@anthropic-ai/claude-code`
npmパッケージを直接利用し、Vim/Neovim両方で動作するクロスプラットフォームなプラグインを開発します。

## 技術スタック

### 1. コアフレームワーク

- **denops.vim**: Denoベースのプラグインフレームワーク
  - 非同期処理のサポート
  - TypeScriptによる型安全な開発
  - Vim/Neovim両対応

### 2. Claude Code統合

- **@anthropic-ai/claude-code NPMパッケージ**: Claude Code CLIのSDK
  - Denoのnpm import機能（`npm:@anthropic-ai/claude-code`）を使用
  - TypeScript SDKの直接利用
  - WebSocketベースのMCPプロトコル実装

### 3. 参考実装

- **claudecode.nvim**: Luaによる既存実装
  - WebSocketサーバー実装パターン
  - ロックファイルシステム
  - MCPツールの実装例

## アーキテクチャ設計

### 1. レイヤー構造

```
┌─────────────────────────────────────┐
│        Vimインターフェース層         │
│   (autoload/claudecode.vim)         │
├─────────────────────────────────────┤
│        Denops API層                 │
│   (denops/claudecode/app.ts)       │
├─────────────────────────────────────┤
│      SDK統合層                      │
│  ├─ Claude Code SDK呼び出し        │
│  ├─ プロセス管理                   │
│  └─ WebSocket通信処理              │
├─────────────────────────────────────┤
│      MCPプロトコル実装層            │
│  ├─ WebSocketサーバー              │
│  ├─ 認証処理                       │
│  └─ MCPツール実装                  │
├─────────────────────────────────────┤
│        ユーティリティ層             │
│  ├─ ロックファイル管理             │
│  ├─ 設定管理                       │
│  └─ ロギング                      │
└─────────────────────────────────────┘
```

### 2. 主要コンポーネント

#### 2.1 Claude Code SDK統合

- **機能**: `@anthropic-ai/claude-code`パッケージの直接利用
- **実装方針**:
  ```typescript
  import { query, type SDKMessage } from "npm:@anthropic-ai/claude-code@latest";
  ```
  - 非インタラクティブモード（`--print`）での利用
  - ストリーミングレスポンス処理
  - エラーハンドリング

#### 2.2 WebSocketサーバー

- **機能**: Claude Code CLIとのIDE統合通信
- **実装方針**:
  - Deno標準のWebSocket APIを使用
  - RFC 6455準拠の実装
  - 認証トークン（UUID v4）による検証

#### 2.3 ロックファイルシステム

- **機能**: Claude Code CLIの自動検出機能
- **仕様**:
  ```json
  {
    "pid": 12345,
    "workspaceFolders": ["/path/to/project"],
    "ideName": "Vim/Neovim (denops)",
    "transport": "ws",
    "authToken": "550e8400-e29b-41d4-a716-446655440000"
  }
  ```
- **パス**: `~/.claude/ide/[port].lock` または
  `$CLAUDE_CONFIG_DIR/ide/[port].lock`

#### 2.4 MCPツール実装

主要な12のツールを実装:

1. **openFile**: ファイルを開いて選択範囲を設定
1. **openDiff**: Diffビューの表示（ブロッキング）
1. **getCurrentSelection**: 現在の選択範囲を取得
1. **getLatestSelection**: 最新の選択範囲を取得
1. **getOpenEditors**: 開いているエディタ情報
1. **getWorkspaceFolders**: ワークスペースフォルダー一覧
1. **getDiagnostics**: 言語サーバーの診断情報
1. **checkDocumentDirty**: ファイルの変更状態確認
1. **saveDocument**: ドキュメントの保存
1. **close_tab**: タブを閉じる
1. **closeAllDiffTabs**: すべてのDiffタブを閉じる
1. **executeCode**: Jupyterカーネルでのコード実行（オプション）

## 実装フェーズ

### フェーズ1: 基盤構築（1週間）

#### 1.1 プロジェクト初期化

- Denopsプラグイン構造の作成
- 型定義ファイルの整備
- 基本的なVimコマンドの定義

#### 1.2 Claude Code SDK統合

```typescript
// denops/claudecode/sdk.ts
import { query, type SDKMessage } from "npm:@anthropic-ai/claude-code@latest";

export async function* executeQuery(
  prompt: string,
  options?: QueryOptions,
): AsyncGenerator<SDKMessage> {
  const abortController = new AbortController();

  for await (
    const message of query({
      prompt,
      abortController,
      options: {
        maxTurns: options?.maxTurns ?? 3,
        outputFormat: "stream-json",
      },
    })
  ) {
    yield message;
  }
}
```

#### 1.3 設定システム

```vim
" Vim設定例
let g:claudecode_config = {
  \ 'port_range': {'min': 10000, 'max': 65535},
  \ 'auto_start': v:true,
  \ 'log_level': 'info',
  \ 'auth_required': v:true,
  \ 'terminal': {
  \   'split_side': 'right',
  \   'width_percentage': 0.4,
  \ }
  \ }
```

### フェーズ2: WebSocket通信実装（2週間）

#### 2.1 WebSocketサーバー

```typescript
// denops/claudecode/server/websocket.ts
export class WebSocketServer {
  private server: Deno.HttpServer;
  private clients: Map<string, WebSocket>;
  private authToken: string;

  async start(port: number): Promise<void> {
    this.server = Deno.serve({
      port,
      hostname: "127.0.0.1",
      handler: this.handleRequest.bind(this),
    });
  }

  private async handleRequest(req: Request): Promise<Response> {
    // WebSocketアップグレード処理
    const upgrade = req.headers.get("upgrade");
    if (upgrade !== "websocket") {
      return new Response("Not a WebSocket request", { status: 400 });
    }

    // 認証トークン検証
    const authHeader = req.headers.get("x-claude-code-ide-authorization");
    if (authHeader !== this.authToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    // WebSocket接続確立
    const { socket, response } = Deno.upgradeWebSocket(req);
    this.handleWebSocket(socket);
    return response;
  }
}
```

#### 2.2 MCPメッセージハンドリング

```typescript
// denops/claudecode/protocol/mcp.ts
interface MCPMessage {
  jsonrpc: "2.0";
  method?: string;
  params?: unknown;
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class MCPHandler {
  async handleMessage(message: MCPMessage): Promise<MCPMessage | void> {
    if (message.method === "tools/call") {
      const params = message.params as ToolCallParams;
      const result = await this.callTool(params.name, params.arguments);
      return {
        jsonrpc: "2.0",
        id: message.id,
        result,
      };
    }
    // 他のメッセージタイプの処理
  }
}
```

### フェーズ3: MCPツール実装（2週間）

#### 3.1 ファイル操作ツール

```typescript
// denops/claudecode/tools/file.ts
export const openFile: MCPTool = {
  name: "openFile",
  description: "Open a file in the editor",
  inputSchema: {
    type: "object",
    properties: {
      filePath: { type: "string" },
      preview: { type: "boolean", default: false },
      startText: { type: "string" },
      endText: { type: "string" },
      selectToEndOfLine: { type: "boolean", default: false },
      makeFrontmost: { type: "boolean", default: true },
    },
    required: ["filePath"],
  },
  handler: async (args, denops) => {
    // Vimコマンドを使用してファイルを開く
    await denops.cmd(`edit ${args.filePath}`);

    // 選択範囲の設定
    if (args.startText && args.endText) {
      // テキスト検索と選択
    }

    return {
      content: [{
        type: "text",
        text: `Opened file: ${args.filePath}`,
      }],
    };
  },
};
```

#### 3.2 Diff表示ツール

```typescript
// denops/claudecode/tools/diff.ts
export const openDiff: MCPTool = {
  name: "openDiff",
  description: "Open a diff view",
  inputSchema: {
    type: "object",
    properties: {
      old_file_path: { type: "string" },
      new_file_path: { type: "string" },
      new_file_contents: { type: "string" },
      tab_name: { type: "string" },
    },
    required: ["old_file_path", "new_file_path", "new_file_contents"],
  },
  handler: async (args, denops) => {
    // 一時ファイルの作成
    const tempFile = await Deno.makeTempFile();
    await Deno.writeTextFile(tempFile, args.new_file_contents);

    // Vimのdiff機能を使用
    await denops.cmd(`tabnew ${args.tab_name || "Diff"}`);
    await denops.cmd(`edit ${args.old_file_path}`);
    await denops.cmd(`vertical diffsplit ${tempFile}`);

    // ユーザーの操作を待つ（ブロッキング）
    const result = await waitForUserAction(denops);

    return {
      content: [{
        type: "text",
        text: result === "saved" ? "FILE_SAVED" : "DIFF_REJECTED",
      }],
    };
  },
};
```

### フェーズ4: UI/UX実装（1週間）

#### 4.1 プロンプトバッファ実装

```typescript
// denops/claudecode/ui/prompt.ts
export class PromptBuffer {
  private bufnr: number;
  private conversation: Message[] = [];

  async create(denops: Denops): Promise<void> {
    // 新しいバッファを作成
    this.bufnr = await denops.call("bufnr", "%") as number;

    // バッファオプションの設定
    await batch(denops, async (denops) => {
      await option.buftype.setLocal(denops, "prompt");
      await option.filetype.setLocal(denops, "claudecode");
      await option.swapfile.setLocal(denops, false);
    });

    // プロンプトコールバックの設定
    await denops.cmd(`
      call prompt_setcallback(${this.bufnr},
        function('denops#request', ['claudecode', 'onPromptInput']))
    `);
  }

  async onInput(input: string): Promise<void> {
    // SDKを使用してクエリを実行
    const messages = executeQuery(input);

    for await (const message of messages) {
      await this.appendMessage(message);
    }
  }
}
```

#### 4.2 選択範囲の追跡

```typescript
// denops/claudecode/selection.ts
export class SelectionTracker {
  private lastSelection?: Selection;
  private debounceTimer?: number;

  async enable(denops: Denops): Promise<void> {
    // 自動コマンドの設定
    await autocmd.group(denops, "ClaudeCodeSelection", (helper) => {
      helper.define(
        ["CursorMoved", "CursorMovedI", "TextChanged"],
        "*",
        `call denops#notify('${denops.name}', 'onSelectionChange', [])`,
      );
    });
  }

  async onSelectionChange(denops: Denops): Promise<void> {
    // デバウンス処理
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      const selection = await this.getCurrentSelection(denops);
      if (selection && this.hasChanged(selection)) {
        await this.broadcastSelection(selection);
      }
    }, 50);
  }
}
```

### フェーズ5: テスト戦略と実装（2週間）

#### 5.0 テストフレームワーク

このプロジェクトでは、[deno-denops-test](https://github.com/vim-denops/deno-denops-test)
を使用してテストを実装します。これはdenopsプラグイン専用に設計されたテストフレームワークで、以下の機能を提供します：

- **実際のVim/Neovimプロセスでのテスト**: `test()` 関数を使用
- **モックテスト**: `DenopsStub` クラスを使用
- **複数のテストモード**: vim, nvim, all, any

##### 環境設定

テストを実行するには、以下の環境変数が必要です：

```bash
# 必須: denops.vimのパスを設定
export DENOPS_TEST_DENOPS_PATH=/path/to/denops.vim

# オプション: Vim/Neovimの実行ファイルパス
export DENOPS_TEST_VIM_EXECUTABLE=vim
export DENOPS_TEST_NVIM_EXECUTABLE=nvim

# オプション: デバッグ出力を有効化
export DENOPS_TEST_VERBOSE=1
```

#### 5.1 テストアーキテクチャ

```
test/
├── unit/                    # ユニットテスト
│   ├── sdk_test.ts         # Claude Code SDK統合のテスト
│   ├── session_test.ts     # セッション管理のテスト
│   └── state_test.ts       # 状態管理のテスト
├── integration/            # 統合テスト
│   ├── denops_test.ts     # Denops通信のテスト
│   └── buffer_test.ts     # バッファ操作のテスト
├── e2e/                    # E2Eテスト
│   └── commands_test.ts   # Vimコマンドのテスト
├── mocks/                  # モックデータ
│   ├── claude_sdk.ts      # Claude Code SDKのモック
│   └── responses.ts       # サンプルレスポンス
└── fixtures/              # テストフィクスチャ
    └── test_project/      # テスト用プロジェクト
```

#### 5.2 ユニットテスト

##### 5.2.1 セッション管理テスト

```typescript
// test/unit/session_test.ts
import { assertEquals, assertExists } from "jsr:@std/assert";
import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { currentSessionId, sessions } from "../../denops/claudecode/app.ts";

describe("Session Management", () => {
  beforeEach(() => {
    sessions.clear();
    currentSessionId = null;
  });

  it("should create a new session", () => {
    const sessionId = createSession(1234, "sonnet");
    assertExists(sessions.get(sessionId));
    assertEquals(currentSessionId, sessionId);
  });

  it("should handle multiple sessions", () => {
    const session1 = createSession(1234, "sonnet");
    const session2 = createSession(5678, "opus");

    assertEquals(sessions.size, 2);
    assertEquals(currentSessionId, session2);
  });

  it("should clean up ended sessions", () => {
    const sessionId = createSession(1234, "sonnet");
    endSession(sessionId);

    assertEquals(sessions.has(sessionId), false);
    assertEquals(currentSessionId, null);
  });
});
```

##### 5.2.2 Claude Code SDKモックテスト

```typescript
// test/unit/sdk_test.ts
import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { createMockQuery } from "../mocks/claude_sdk.ts";

describe("Claude Code SDK Integration", () => {
  it("should handle streaming responses", async () => {
    const mockQuery = createMockQuery([
      { type: "system", message: "Starting..." },
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "Hello" }] },
      },
      { type: "result", usage: { input_tokens: 10, output_tokens: 5 } },
    ]);

    const messages = [];
    for await (const msg of mockQuery("Test prompt")) {
      messages.push(msg);
    }

    assertEquals(messages.length, 3);
    assertEquals(messages[1].message.content[0].text, "Hello");
  });

  it("should handle errors gracefully", async () => {
    const mockQuery = createMockQuery(new Error("API Error"));

    try {
      for await (const _ of mockQuery("Test prompt")) {
        // Should throw
      }
    } catch (error) {
      assertEquals(error.message, "API Error");
    }
  });
});
```

#### 5.3 統合テスト

##### 5.3.1 Denops通信テスト（deno-denops-test使用）

```typescript
// test/integration/denops_test.ts
import { test } from "jsr:@denops/test@^6.0.0";
import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.0";

test({
  mode: "all",
  name: "Denops dispatcher functions",
  fn: async (denops) => {
    // セッション開始テスト
    const sessionId = await denops.dispatch("claudecode", "startSession", [
      1,
      "sonnet",
    ]);
    assertEquals(typeof sessionId, "string");

    // セッション情報取得テスト
    const info = await denops.dispatch("claudecode", "getSessionInfo", [
      sessionId,
    ]);
    assertEquals(info.model, "sonnet");
    assertEquals(info.bufnr, 1);

    // セッション終了テスト
    await denops.dispatch("claudecode", "endSession", [sessionId]);
    const endedInfo = await denops.dispatch("claudecode", "getSessionInfo", [
      sessionId,
    ]);
    assertEquals(endedInfo, null);
  },
});

// Vim専用テスト
test({
  mode: "vim",
  name: "Vim-specific buffer operations",
  fn: async (denops) => {
    const sessionId = await denops.dispatch("claudecode", "startSession", [
      1,
      "sonnet",
    ]);
    const bufname = await denops.call("bufname", 1);
    assertEquals(typeof bufname, "string");
    await denops.dispatch("claudecode", "endSession", [sessionId]);
  },
});

// Neovim専用テスト
test({
  mode: "nvim",
  name: "Neovim-specific features",
  fn: async (denops) => {
    const hasNvim = await denops.call("has", "nvim");
    assertEquals(hasNvim, 1);
  },
});
```

##### 5.3.2 DenopsStubを使用したモックテスト

```typescript
// test/unit/denops_stub_test.ts
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { DenopsStub } from "jsr:@denops/test@^6.0.0";

Deno.test("Denops Plugin with Stub", async () => {
  // カスタムディスパッチャー実装でスタブを作成
  const denops = new DenopsStub({
    name: "claudecode",
    dispatcher: {
      startSession: (bufnr: unknown, model?: unknown) => {
        return Promise.resolve("test-session-id");
      },
      getSessionInfo: (sessionId: unknown) => {
        if (sessionId === "test-session-id") {
          return Promise.resolve({
            id: "test-session-id",
            model: "sonnet",
            bufnr: 1,
            messages: [],
            active: true,
          });
        }
        return Promise.resolve(null);
      },
    },
  });

  // ディスパッチャーメソッドのテスト
  const sessionId = await denops.dispatch("claudecode", "startSession", [
    1,
    "sonnet",
  ]);
  assertEquals(sessionId, "test-session-id");

  const info = await denops.dispatch("claudecode", "getSessionInfo", [
    "test-session-id",
  ]);
  assertEquals(info?.model, "sonnet");
});
```

##### 5.3.3 バッファ操作テスト

```typescript
// test/integration/buffer_test.ts
import { test } from "jsr:@denops/test@^6.0.0";
import { assertEquals } from "jsr:@std/assert@^1.0.0";

test({
  mode: "all",
  name: "Buffer operations",
  fn: async (denops) => {
    // バッファ作成テスト
    const bufnr = await denops.call("claudecode#buffer#create");
    assertEquals(typeof bufnr, "number");

    // バッファへの行追加テスト
    await denops.call("claudecode#buffer#append_line", bufnr, "Test line");
    const lines = await denops.call("getbufline", bufnr, 1, "$");
    assertEquals(lines.includes("Test line"), true);

    // 最終行の置換テスト
    await denops.call(
      "claudecode#buffer#replace_last_line",
      bufnr,
      "Replaced line",
    );
    const lastLine = await denops.call("getline", "$");
    assertEquals(lastLine, "Replaced line");
  },
});
```

#### 5.4 E2Eテスト

```typescript
// test/e2e/commands_test.ts
import { test } from "jsr:@denops/test@^6.0.0";
import {
  assertEquals,
  assertExists,
  assertMatch,
} from "jsr:@std/assert@^1.0.0";

test({
  mode: "all",
  name: "ClaudeCode commands",
  fn: async (denops) => {
    // ClaudeCodeStartコマンドテスト
    await denops.cmd("ClaudeCodeStart sonnet");
    const sessionId = await denops.dispatch(
      "claudecode",
      "getCurrentSession",
      [],
    );
    assertExists(sessionId);

    // バッファが作成されていることを確認
    const bufname = await denops.call("bufname", "%");
    assertMatch(bufname, /ClaudeCode-\d+/);

    // ClaudeCodeEndコマンドテスト
    await denops.cmd("ClaudeCodeEnd");
    const endedSession = await denops.dispatch(
      "claudecode",
      "getCurrentSession",
      [],
    );
    assertEquals(endedSession, null);
  },
});
```

#### 5.5 パフォーマンステスト

```typescript
// test/performance/benchmark_test.ts
import { bench } from "jsr:@std/testing/bench";

bench({
  name: "Session creation performance",
  runs: 1000,
  func: () => {
    const sessionId = crypto.randomUUID();
    const session = {
      id: sessionId,
      model: "sonnet",
      bufnr: 1,
      messages: [],
      active: true,
    };
    sessions.set(sessionId, session);
  },
});

bench({
  name: "Large message handling",
  runs: 100,
  func: async () => {
    const largeText = "x".repeat(10000);
    const messages = [];
    for (let i = 0; i < 100; i++) {
      messages.push({
        content: [{ type: "text", text: largeText }],
      });
    }
    // Process messages
  },
});
```

#### 5.6 テスト実行設定

##### 5.6.1 deno.jsonへのテストタスク追加

```json
{
  "tasks": {
    "test": "deno test --allow-all --unstable test/",
    "test:unit": "deno test --allow-all test/unit/",
    "test:integration": "deno test --allow-all test/integration/",
    "test:e2e": "deno test --allow-all test/e2e/",
    "test:coverage": "deno test --allow-all --coverage=coverage test/",
    "test:watch": "deno test --allow-all --watch test/",
    "bench": "deno bench --allow-all test/performance/"
  }
}
```

##### 5.6.2 CI/CD設定（GitHub Actions）

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      - name: Run unit tests
        run: deno task test:unit
      - name: Run integration tests
        run: deno task test:integration
      - name: Generate coverage
        run: deno task test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

#### 5.7 テストのベストプラクティス

1. **モックの活用**

   - Claude Code SDKの呼び出しは必ずモック化
   - 外部依存を最小化

1. **テストの独立性**

   - 各テストは他のテストに依存しない
   - セットアップとクリーンアップを確実に実行

1. **エラーケースのカバー**

   - 正常系だけでなく異常系もテスト
   - エッジケースを網羅的にテスト

1. **パフォーマンスの監視**

   - ベンチマークテストで性能劣化を検知
   - メモリリークのチェック

## セキュリティ考慮事項

1. **WebSocketサーバー**

   - 必ず`127.0.0.1`にバインド（ローカルホストのみ）
   - 認証トークンによる接続検証
   - 不正なリクエストの拒否

1. **ファイルアクセス**

   - ワークスペース外へのアクセス制限
   - シンボリックリンクの適切な処理
   - 権限チェック

1. **コード実行**

   - サンドボックス環境での実行
   - 危険なコマンドの制限
   - ユーザー確認の実装

## 今後の拡張

### v0.1.0 (MVP)

- 基本的なClaude Code SDK統合
- WebSocket通信
- 主要MCPツール（openFile, openDiff, selection）

### v0.2.0

- 完全なMCPツールセット
- ファイルツリー統合
- LSP診断情報の統合

### v1.0.0

- 安定版リリース
- 包括的なドキュメント
- カスタムツールAPI
- プラグインエコシステム対応

## まとめ

このプラグインは、`@anthropic-ai/claude-code` SDKを直接利用することで、Claude
Codeの最新機能に迅速に対応できる設計となっています。denops.vimの強力な非同期処理機能とTypeScriptの型安全性を活用し、Vim/Neovimユーザーに最高のClaude
Code体験を提供します。
