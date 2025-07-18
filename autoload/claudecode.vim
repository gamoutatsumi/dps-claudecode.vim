" claudecode.vim - Claude Code integration functions
" Author: Tatsumi GAMOU
" License: MIT

let s:save_cpo = &cpoptions
set cpoptions&vim

" Start Claude Code server
function! claudecode#start() abort
  return denops#request('claudecode', 'start', [])
endfunction

" Stop Claude Code server
function! claudecode#stop() abort
  return denops#request('claudecode', 'stop', [])
endfunction

" Get server status
function! claudecode#status() abort
  return denops#request('claudecode', 'status', [])
endfunction

" Open prompt buffer
function! claudecode#open_prompt() abort
  return denops#request('claudecode', 'openPrompt', [])
endfunction

" Restart server
function! claudecode#restart() abort
  call claudecode#stop()
  sleep 1
  return claudecode#start()
endfunction

" Send message to Claude Code
function! claudecode#send_message(message) abort
  return denops#request('claudecode', 'sendMessage', [a:message])
endfunction

" Get current selection for MCP tools
function! claudecode#get_selection() abort
  return denops#request('claudecode', 'getSelection', [])
endfunction

" Open file with selection (for MCP openFile tool)
function! claudecode#open_file(filepath, ...) abort
  let l:options = a:0 > 0 ? a:1 : {}
  return denops#request('claudecode', 'openFile', [a:filepath, l:options])
endfunction

" Check if server is running
function! claudecode#is_running() abort
  try
    let l:status = claudecode#status()
    return l:status.running
  catch
    return v:false
  endtry
endfunction

" Auto start functionality
function! claudecode#auto_start() abort
  if !claudecode#is_running()
    call claudecode#start()
  endif
endfunction

" Error handling helper
function! claudecode#handle_error(error) abort
  if type(a:error) == v:t_dict && has_key(a:error, 'message')
    echohl ErrorMsg
    echom '[claudecode] ' . a:error.message
    echohl None
  else
    echohl ErrorMsg
    echom '[claudecode] ' . string(a:error)
    echohl None
  endif
endfunction

" Success message helper
function! claudecode#show_message(message) abort
  echohl MoreMsg
  echom '[claudecode] ' . a:message
  echohl None
endfunction

let &cpoptions = s:save_cpo
unlet s:save_cpo