# CLAUDE.md

このファイルは、このリポジトリでClaude Code (claude.ai/code)
が作業する際のガイダンスを提供します。

## リポジトリ概要

このプロジェクトは、denops.vim（Denoベースのプラグインフレームワーク）を使用してClaude
Codeを統合するVim/Neovimプラグインです。現在は初期開発段階で、基本的な構造のみが整備されています。

## 開発コマンド

- **開発環境に入る**: `nix develop` または `direnv allow`
  (`.envrc`が存在する場合)
- **コードフォーマット**: `nix fmt` または `treefmt` (pre-commit hooks
  で自動チェックされるので手動での実行は不要)
- **TypeScript/Denoコードの lint**: git commitの際に pre-commit hooks で自動実行
- **すべてのチェックを手動実行**: `nix flake check`

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
- プラグインの骨組みは設定済みだが、まだ機能は実装されていない

## プロジェクトの目標

このプラグインは以下の機能を提供することを目指しています：

1. **Claude Codeとの統合**: Vim/Neovim内から直接Claude Codeと対話
1. **非同期処理**: denops.vimを活用した快適なユーザー体験
1. **拡張性**: 将来的な機能追加を考慮した設計

## ディレクトリ構造

```
.
├── autoload/           # Vimスクリプトのエントリーポイント
├── denops/            # TypeScript/Denoコード
│   └── claudecode/    # プラグインのメインロジック
├── doc/               # Vimヘルプドキュメント
├── plugin/            # Vimプラグインの初期化
└── flake.nix          # Nix開発環境の定義
```

## 貢献時の注意事項

- TypeScriptコードはDeno標準に従うこと
- 新機能を追加する際は、適切なドキュメントも更新すること
- エラーハンドリングは適切に行い、ユーザーフレンドリーなメッセージを提供すること

## 今後の実装予定

- 基本的なClaude Codeとの通信機能
- コマンドインターフェースの実装
- 設定オプションの追加
- ユーザードキュメントの充実
