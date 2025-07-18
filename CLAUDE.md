# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Repository Overview

This is a Vim/Neovim plugin that integrates Claude Code using denops.vim
(Deno-based plugin framework). The plugin is in early development stage with
skeleton structure in place.

## Development Commands

- **Enter development environment**: `nix develop` or `direnv allow` (If
  `.envrc` exists.)
- **Format code**: `nix fmt` or `treefmt`
- **Lint TypeScript/Deno code**: Automatically runs via pre-commit hooks on git
  commit
- **Run all checks manually**: `nix flake check`

## Architecture

The plugin follows standard denops.vim architecture:

1. **Vim Interface Layer** (`/autoload/claudecode.vim`): Exposes Vim commands
   and functions
1. **TypeScript Core** (`/denops/claudecode/app.ts`): Main plugin logic using
   Deno runtime
1. **Documentation** (`/doc/`): Vim help files

Denops.vim acts as the bridge between Vim/Neovim and TypeScript, allowing async
operations and modern JavaScript features.

## Development Environment

The project uses Nix flakes for reproducible development environments with:

- Configured formatters (Deno, Nix, Markdown, YAML)
- Pre-commit hooks for code quality
- MCP servers for enhanced Claude Code functionality
- Automatic environment loading via direnv

## Key Development Notes

- All TypeScript code should be written for Deno runtime (not Node.js)
- Follow denops.vim conventions for plugin structure
- Use the existing formatter configuration - don't add new formatting tools
- The plugin skeleton is set up but no functionality is implemented yet
