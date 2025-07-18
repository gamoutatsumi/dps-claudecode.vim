" dps-claudecode.vim - Claude Code integration for Vim/Neovim via denops.vim
" Author: Tatsumi GAMOU
" License: MIT

if exists('g:loaded_claudecode')
  finish
endif
let g:loaded_claudecode = 1

" Save user's cpoptions
let s:save_cpo = &cpoptions
set cpoptions&vim

" Default configuration
let g:claudecode_config = get(g:, 'claudecode_config', {})
call extend(g:claudecode_config, {
  \ 'port_range': {'min': 10000, 'max': 65535},
  \ 'auto_start': v:true,
  \ 'log_level': 'info',
  \ 'auth_required': v:true,
  \ 'prompt_buffer': {
  \   'split_direction': 'vertical',
  \   'size': 80,
  \ }
  \ }, 'keep')

" Commands
command! ClaudeCodeStart call denops#request('claudecode', 'start', [])
command! ClaudeCodeStop call denops#request('claudecode', 'stop', [])
command! ClaudeCodePrompt call denops#request('claudecode', 'openPrompt', [])
command! ClaudeCodeStatus call denops#request('claudecode', 'status', [])
command! ClaudeCodeRestart call denops#request('claudecode', 'restart', [])

" Auto-start if configured
if g:claudecode_config.auto_start
  autocmd VimEnter * call denops#request('claudecode', 'autoStart', [])
endif

" Restore user's cpoptions
let &cpoptions = s:save_cpo
unlet s:save_cpo