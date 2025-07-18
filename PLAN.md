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

### フェーズ5: 統合とテスト（1週間）

#### 5.1 E2Eテスト

```typescript
// test/e2e/integration_test.ts
Deno.test("Claude Code integration", async () => {
  const denops = await getTestDenops();

  // WebSocketサーバーの起動
  await denops.dispatch("claudecode", "start", []);

  // Claude Code CLIの起動をシミュレート
  const client = await connectWebSocket();

  // ツール呼び出しのテスト
  const response = await client.call("openFile", {
    filePath: "/test/file.ts",
  });

  assertEquals(response.content[0].text, "Opened file: /test/file.ts");
});
```

#### 5.2 パフォーマンステスト

- 大規模ファイルでの応答時間測定
- 並行接続時の安定性確認
- メモリ使用量の監視

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
