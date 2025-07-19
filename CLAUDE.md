# CLAUDE.md

このファイルは、このリポジトリでClaude Code (claude.ai/code)
が作業する際のガイダンスを提供します。

## リポジトリ概要

このプロジェクトは、denops.vim（Denoベースのプラグインフレームワーク）を使用してClaude
Codeを統合するVim/Neovimプラグインです。基本的なチャット機能が実装されており、Claude
Code SDKを使用した対話的なセッションが利用可能です。

## 開発コマンド

- **開発環境に入る**: `nix develop` または `direnv allow`
  (`.envrc`が存在する場合)
- **コードフォーマット**: `nix fmt` または `treefmt` (pre-commit hooks
  で自動チェックされるので手動での実行は不要)
- **TypeScript/Denoコードの lint**: git commitの際に pre-commit hooks で自動実行
- **すべてのチェックを手動実行**: `nix flake check`
- **Denoの依存関係のアップデート**: `deno task molt`

## アーキテクチャ

このプラグインは標準的なdenops.vimアーキテクチャに従っています：

1. **Vimインターフェース層** (`/autoload/claudecode.vim`):
   Vimコマンドと関数を公開
1. **TypeScriptコア** (`/denops/claudecode/app.ts`):
   Denoランタイムを使用したメインプラグインロジック
1. **ドキュメント** (`/doc/`): Vimヘルプファイル

Denops.vimは、Vim/NeovimとTypeScriptの間のブリッジとして機能し、非同期操作と最新のJavaScript機能を可能にします。

Vim 側のユーザーインターフェースとして、 prompt buffer を利用して、対話的に
Claude Code を利用できるようにします。

また、 https://github.com/coder/claudecode.nvim の実装を参考に Claude Code の
IDE 連携の仕組みを Denops で実装します。

## 利用ライブラリ

- Claude Code SDK
  - Claude Code との通信に使う
  - `@anthropic-ai/claude-code` npm パッケージを利用し、Deno の npm import
    機能を使って Denops から SDK を直接利用する
- denops.vim
  - Vim 内でTypeScriptを使うためのフレームワークプラグイン
  - https://github.com/vim-denops/denops.vim

## 開発環境

このプロジェクトはNix flakesを使用して再現可能な開発環境を提供します：

- 設定済みフォーマッター（Deno、Nix、Markdown、YAML）
- コード品質のための pre-commit hooks
- Claude Code機能を強化するためのMCPサーバー
- direnvによる自動環境読み込み

## 主要な開発上の注意点

- すべてのTypeScriptコードはDenoランタイム用に書くこと（Node.jsではない）
- denops.vimの規約に従ったプラグイン構造を維持すること
- 既存のフォーマッター設定を使用し、新しいフォーマッティングツールを追加しないこと
- Claude Code SDKは`npm:`プレフィックスを使用してインポートすること

## プロジェクトの目標

このプラグインは以下の機能を提供することを目指しています：

1. **Claude Codeとの統合**: Vim/Neovim内から直接Claude Codeと対話
1. **非同期処理**: denops.vimを活用した快適なユーザー体験
1. **拡張性**: 将来的な機能追加を考慮した設計

## ディレクトリ構造

```
.
├── autoload/           # Vimスクリプトのエントリーポイント
│   ├── claudecode.vim      # メインのVimインターフェース
│   └── claudecode/
│       └── buffer.vim      # プロンプトバッファ管理
├── denops/            # TypeScript/Denoコード
│   └── claudecode/
│       └── app.ts          # Claude Code SDK統合とセッション管理
├── doc/               # Vimヘルプドキュメント
│   └── claudecode.txt      # ユーザー向けドキュメント
├── plugin/            # Vimプラグインの初期化
│   └── claudecode.vim      # コマンド定義とグローバル設定
├── ARCHITECTURE.md    # システム設計ドキュメント
├── PLAN.md           # 開発ロードマップ
├── deno.json         # Deno設定ファイル
└── flake.nix         # Nix開発環境の定義
```

## 現在の実装状態

### コマンド

- `:ClaudeCodeStart [model]` - 新しいセッションを開始
- `:ClaudeCodeEnd` - 現在のセッションを終了
- `:ClaudeCodeSend {message}` - メッセージを送信
- `:ClaudeCode {message}` - クイックコマンド（セッション開始と送信を一度に）
- `:ClaudeCodeList` - アクティブなセッション一覧
- `:ClaudeCodeSwitch {session-id}` - セッションの切り替え
- `:ClaudeCodeModel {model}` - モデルの切り替え

### キーマッピング

- `<Leader>cc` - セッション開始
- `<Leader>ce` - セッション終了
- `<Leader>cl` - セッション一覧
- `<Leader>cs` - 選択テキストを送信（ビジュアルモード）

## 貢献時の注意事項

- TypeScriptコードはDeno標準に従うこと
- 新機能を追加する際は、適切なドキュメントも更新すること
- エラーハンドリングは適切に行い、ユーザーフレンドリーなメッセージを提供すること
- コミットメッセージはConventional Commitsに従うこと
- 変更のコミットはリファクタリング、機能追加、テスト追加の3つの粒度で分けること
- PLAN.md のロードマップに沿った変更を行う時は、変更点を PLAN.md に反映すること
- 実装予定のものも含め、設計ドキュメントは ARCHITECTURE.md に記述すること

### 型安全性の確保

- unknown型の処理には`unknownutil`を使用すること
  - パッケージは直接URLインポート（`jsr:@core/unknownutil@<version>`）を使用
  - `deno.json`での依存管理は使用しない
- 型アサーション（`as`）の代わりに`ensure`関数を使用すること
- オブジェクト型の検証には事前に名前付き述語を定義すること
  ```typescript
  // Good
  const isSessionInfo = is.ObjectOf({
    model: is.String,
    bufnr: is.Number,
    active: is.Boolean,
  });
  const sessionInfo = ensure(data, isSessionInfo);

  // Bad
  const sessionInfo = data as { model: string; bufnr: number; active: boolean };
  ```
- 複合型（Union型など）にも分かりやすい名前を付けること
  ```typescript
  const isSessionInfoOrNull = is.UnionOf([isSessionInfo, is.Null]);
  const isTextOrTextArray = is.UnionOf([is.String, is.ArrayOf(is.String)]);
  ```

## 実装済み機能

- Claude Code SDKを使用した基本的な通信機能
- プロンプトバッファを使用した対話的インターフェース
- 複数セッションの管理
- モデル切り替え機能（opus, sonnet等）
- ストリーミングレスポンスの表示
- エラーハンドリング
- Vimヘルプドキュメント

## 今後の実装予定

- IDE連携機能（ファイルコンテキストの送信）
- 選択範囲のコード送信機能の改善
- MCPサーバーとの統合
- カスタムプロンプトテンプレート
- より高度なファイル編集機能
