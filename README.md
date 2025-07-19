# dps-claudecode.vim

Claude Code integration for Vim/Neovim powered by denops.vim

## Features

- Interactive chat sessions with Claude Code directly in Vim/Neovim
- Multiple concurrent sessions support
- Model switching (opus, sonnet, etc.)
- File editing capabilities through Claude Code tools
- Prompt buffer interface for easy interaction

## Requirements

- Vim 9.1.0448+ or Neovim 0.12.0+
- [denops.vim](https://github.com/vim-denops/denops.vim)
- Deno runtime 2.4.0+

## Installation

### Using vim-plug

```vim
Plug 'vim-denops/denops.vim'
Plug 'gamoutatsumi/dps-claudecode.vim'
```

### Using dein.vim

```vim
call dein#add('vim-denops/denops.vim')
call dein#add('gamoutatsumi/dps-claudecode.vim')
```

## Usage

### Commands

- `:ClaudeCodeStart [model]` - Start a new Claude Code session
- `:ClaudeCodeEnd` - End the current session
- `:ClaudeCodeSend {message}` - Send a message to Claude
- `:ClaudeCode {message}` - Quick command to start and send
- `:ClaudeCodeList` - List all active sessions
- `:ClaudeCodeSwitch {session-id}` - Switch between sessions
- `:ClaudeCodeModel {model}` - Change model for current session

### Default Key Mappings

- `<Leader>cc` - Start a new Claude Code session
- `<Leader>ce` - End the current session
- `<Leader>cl` - List all sessions
- `<Leader>cs` - Send selected text to Claude (visual mode)

### Configuration

```vim
" Default model (default: 'sonnet')
let g:claudecode_default_model = 'opus'

" Auto-scroll chat buffer (default: 1)
let g:claudecode_auto_scroll = 1

" Disable default mappings
let g:claudecode_no_mappings = 1
```

## Example Workflow

1. Start a session: `:ClaudeCodeStart`
1. Type your message in the prompt buffer and press Enter
1. Claude will respond in the same buffer
1. Continue the conversation as needed
1. End the session: `:ClaudeCodeEnd` or press `q` in the buffer

## License

Same terms as Vim itself (see `:help license`)
