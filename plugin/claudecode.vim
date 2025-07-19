" Claude Code plugin for Vim/Neovim
" Integrates Claude Code via denops.vim

if exists('g:loaded_claudecode')
  finish
endif
let g:loaded_claudecode = 1

" Configuration variables
let g:claudecode_default_model = get(g:, 'claudecode_default_model', 'sonnet')
let g:claudecode_auto_scroll = get(g:, 'claudecode_auto_scroll', 1)

" Commands
command! -nargs=? ClaudeCodeStart call claudecode#start(<f-args>)
command! ClaudeCodeEnd call claudecode#end()
command! -nargs=1 ClaudeCodeSend call claudecode#send_message(<q-args>)
command! ClaudeCodeList call claudecode#list_sessions()
command! -nargs=1 ClaudeCodeSwitch call claudecode#switch_session(<q-args>)
command! -nargs=1 ClaudeCodeModel call claudecode#switch_model(<q-args>)

" Convenience command to start and send in one go
command! -nargs=+ ClaudeCode call s:claude_code_quick(<q-args>)

function! s:claude_code_quick(args) abort
  " If no active session, start one
  if empty(claudecode#get_current_session())
    call claudecode#start(g:claudecode_default_model)
  endif

  " Send the message
  call claudecode#send_message(a:args)
endfunction

" Default key mappings (can be disabled with g:claudecode_no_mappings)
if !exists('g:claudecode_no_mappings')
  nnoremap <silent> <Leader>cc :ClaudeCodeStart<CR>
  nnoremap <silent> <Leader>ce :ClaudeCodeEnd<CR>
  nnoremap <silent> <Leader>cl :ClaudeCodeList<CR>
  vnoremap <silent> <Leader>cs :<C-u>call claudecode#send_message(getline("'<", "'>"))<CR>
endif