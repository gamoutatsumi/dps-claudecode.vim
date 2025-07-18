# dps-claudecode.vim

VimとNeovimでClaude Codeを統合するdenops.vimプラグインです。

## 概要

このプラグインは、[denops.vim](https://github.com/vim-denops/denops.vim)を使用してClaude Codeとの統合を提供します。対話的なプロンプトバッファーとWebSocket通信を通じて、Vim/Neovim内から直接Claude Codeと対話できます。

## 特徴

- **Claude Code SDK統合**: `@anthropic-ai/claude-code` npmパッケージを使用した直接統合
- **非同期処理**: denops.vimによる高速な非同期通信
- **対話的UI**: プロンプトバッファーを使用した自然な対話体験
- **MCP対応**: Model Context Protocol (MCP) によるIDE統合
- **クロスプラットフォーム**: Vim/Neovim両対応

## 前提条件

- Vim 8.2+ または Neovim 0.6+
- [Deno](https://deno.land/) 1.40+
- [denops.vim](https://github.com/vim-denops/denops.vim)
- Claude Code CLI

## インストール

### vim-plug

```vim
Plug 'vim-denops/denops.vim'
Plug 'gamoutatsumi/dps-claudecode.vim'
```

### dein.vim

```vim
call dein#add('vim-denops/denops.vim')
call dein#add('gamoutatsumi/dps-claudecode.vim')
```

### Lazy.nvim

```lua
{
  'gamoutatsumi/dps-claudecode.vim',
  dependencies = { 'vim-denops/denops.vim' },
}
```

## 使用方法

### 基本的な使用

```vim
" Claude Codeセッションを開始
:ClaudeCodeStart

" プロンプトバッファーを開く
:ClaudeCodePrompt

" Claude Codeサーバーを停止
:ClaudeCodeStop
```

### 設定

```vim
" 設定例
let g:claudecode_config = {
  \ 'port_range': {'min': 10000, 'max': 65535},
  \ 'auto_start': v:true,
  \ 'log_level': 'info',
  \ 'auth_required': v:true,
  \ 'prompt_buffer': {
  \   'split_direction': 'vertical',
  \   'size': 80,
  \ }
  \ }
```

## 開発

### 開発環境のセットアップ

```bash
# Nix環境の場合
nix develop

# direnvを使用している場合
direnv allow
```

### 開発コマンド

```bash
# コードフォーマット
nix fmt

# 全チェック実行
nix flake check

# テスト実行
deno test --allow-all
```

## アーキテクチャ

```
┌─────────────────────────────────────┐
│        Vimインターフェース層         │
│   (autoload/claudecode.vim)         │
├─────────────────────────────────────┤
│        Denops API層                 │
│   (denops/claudecode/app.ts)       │
├─────────────────────────────────────┤
│      Claude Code SDK統合層          │
│  ├─ WebSocket通信                  │
│  ├─ MCP プロトコル実装             │
│  └─ プロンプトバッファー管理        │
└─────────────────────────────────────┘
```

## 貢献

プロジェクトに貢献していただける方は、以下をお読みください：

1. [Issues](https://github.com/gamoutatsumi/dps-claudecode.vim/issues)をチェック
1. フォークして開発ブランチを作成
1. 変更をコミット（コミットメッセージは日本語でも英語でも可）
1. Pull Requestを作成

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)を参照してください。

## 関連プロジェクト

- [denops.vim](https://github.com/vim-denops/denops.vim) - Denoベースのプラグインフレームワーク
- [Claude Code](https://claude.ai/code) - Anthropic社のClaude Code CLI
- [claudecode.nvim](https://github.com/coder/claudecode.nvim) - NeoVim用のClaude Code統合プラグイン（参考実装）

## サポート

問題が発生した場合は、[Issues](https://github.com/gamoutatsumi/dps-claudecode.vim/issues)に報告してください。
