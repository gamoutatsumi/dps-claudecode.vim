# テストガイド

このディレクトリには、dps-claudecode.vimプラグインのテストスイートが含まれています。

## テストフレームワーク

本プロジェクトでは
[deno-denops-test](https://github.com/vim-denops/deno-denops-test)
を使用しています。このフレームワークは、denopsプラグインのテストに特化した機能を提供します。

## ディレクトリ構造

```
test/
├── unit/                    # ユニットテスト
│   ├── session_test.ts     # セッション管理のテスト
│   └── denops_stub_test.ts # DenopsStubを使用したモックテスト
├── integration/            # 統合テスト
│   └── denops_test.ts     # Denops通信のテスト
├── e2e/                    # E2Eテスト
│   └── commands_test.ts   # Vimコマンドのテスト（未実装）
├── mocks/                  # モックデータ
│   └── claude_sdk.ts      # Claude Code SDKのモック
├── fixtures/              # テストフィクスチャ
│   └── test_project/      # テスト用プロジェクト（未実装）
└── performance/           # パフォーマンステスト（未実装）
```

## セットアップ

### 1. denops.vimのクローン

テストを実行するには、まずdenops.vimをクローンする必要があります：

```bash
git clone https://github.com/vim-denops/denops.vim /tmp/denops.vim
export DENOPS_TEST_DENOPS_PATH=/tmp/denops.vim
```

### 2. 環境変数の設定

以下の環境変数を設定できます：

```bash
# 必須: denops.vimのパス
export DENOPS_TEST_DENOPS_PATH=/path/to/denops.vim

# オプション: Vim/Neovimの実行ファイルパス
export DENOPS_TEST_VIM_EXECUTABLE=vim
export DENOPS_TEST_NVIM_EXECUTABLE=nvim

# オプション: デバッグ出力を有効化
export DENOPS_TEST_VERBOSE=1

# オプション: 接続タイムアウト（ミリ秒）
export DENOPS_TEST_CONNECT_TIMEOUT=30000
```

## テストの実行

### すべてのテストを実行

```bash
deno task test
```

### 特定のカテゴリのテストを実行

```bash
# ユニットテストのみ
deno task test:unit

# 統合テストのみ
deno task test:integration

# E2Eテストのみ
deno task test:e2e
```

### カバレッジ付きでテストを実行

```bash
deno task test:coverage
```

### ウォッチモードでテストを実行

```bash
deno task test:watch
```

### パフォーマンステストを実行

```bash
deno task bench
```

## テストの書き方

### 統合テスト（実際のVim/Neovimを使用）

```typescript
import { test } from "jsr:@denops/test@^6.0.0";
import { assertEquals } from "jsr:@std/assert@^1.0.0";

// すべてのホスト（VimとNeovim）でテスト
test({
  mode: "all",
  name: "Test name",
  fn: async (denops) => {
    const result = await denops.call("abs", -4);
    assertEquals(result, 4);
  },
});

// Vimのみでテスト
test({
  mode: "vim",
  name: "Vim-specific test",
  fn: async (denops) => {
    // Vim固有のテスト
  },
});

// Neovimのみでテスト
test({
  mode: "nvim",
  name: "Neovim-specific test",
  fn: async (denops) => {
    // Neovim固有のテスト
  },
});
```

### ユニットテスト（DenopsStubを使用）

```typescript
import { DenopsStub } from "jsr:@denops/test@^6.0.0";
import { assertEquals } from "jsr:@std/assert@^1.0.0";

Deno.test("Unit test with stub", async () => {
  const denops = new DenopsStub({
    call: (fn, ...args) => {
      if (fn === "abs" && args[0] === -4) {
        return Promise.resolve(4);
      }
      return Promise.resolve(null);
    },
  });

  const result = await denops.call("abs", -4);
  assertEquals(result, 4);
});
```

## CI/CD

GitHub Actionsを使用した自動テストが設定されています。詳細は
`.github/workflows/test.yml` を参照してください。

## トラブルシューティング

### テストが失敗する場合

1. `DENOPS_TEST_DENOPS_PATH` が正しく設定されているか確認
1. Vim/Neovimが正しくインストールされているか確認
1. `DENOPS_TEST_VERBOSE=1` でデバッグ出力を有効化して詳細を確認

### タイムアウトエラーが発生する場合

`DENOPS_TEST_CONNECT_TIMEOUT` を増やしてみてください：

```bash
export DENOPS_TEST_CONNECT_TIMEOUT=60000  # 60秒
```

## 貢献

新しいテストを追加する際は、以下のガイドラインに従ってください：

1. 適切なディレクトリにテストファイルを配置
1. テスト名は明確で説明的に
1. エラーケースも必ずテスト
1. モックは `test/mocks/` ディレクトリに配置
