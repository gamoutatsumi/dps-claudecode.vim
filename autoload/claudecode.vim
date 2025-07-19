" Claude Code integration for Vim/Neovim via denops.vim
"
" This file provides the main interface for interacting with Claude Code

let s:save_cpo = &cpo
set cpo&vim

" Check if denops is available
if !exists('g:loaded_denops')
  echoerr 'dps-claudecode requires denops.vim'
  finish
endif

" Start a new Claude Code session
function! claudecode#start(...) abort
  let model = a:0 > 0 ? a:1 : 'sonnet'

  " Create a new buffer for the session
  let bufnr = claudecode#buffer#create()

  " Start session via denops
  let session_id = denops#request('claudecode', 'startSession', [bufnr, model])

  " Setup buffer
  call claudecode#buffer#setup(bufnr, session_id)

  " Show welcome message
  call claudecode#buffer#append_line(bufnr, 'Claude Code Session Started')
  call claudecode#buffer#append_line(bufnr, 'Model: ' . model)
  call claudecode#buffer#append_line(bufnr, '---')
  call claudecode#buffer#append_line(bufnr, '')

  " Focus on the buffer
  execute 'buffer' bufnr

  return session_id
endfunction

" Send a message to Claude
function! claudecode#send_message(message) abort
  let current_session = denops#request('claudecode', 'getCurrentSession', [])
  if empty(current_session)
    echoerr 'No active Claude Code session. Use :ClaudeCodeStart to begin.'
    return
  endif

  let session_info = denops#request('claudecode', 'getSessionInfo', [current_session])
  if empty(session_info)
    echoerr 'Session not found'
    return
  endif

  " Append user message to buffer
  call claudecode#buffer#append_line(session_info.bufnr, 'You: ' . a:message)

  " Send message via denops
  call denops#notify('claudecode', 'sendMessage', [current_session, a:message])
endfunction

" End the current session
function! claudecode#end() abort
  let current_session = denops#request('claudecode', 'getCurrentSession', [])
  if empty(current_session)
    echoerr 'No active Claude Code session'
    return
  endif

  call denops#notify('claudecode', 'endSession', [current_session])
  echo 'Claude Code session ended'
endfunction

" List all sessions
function! claudecode#list_sessions() abort
  let session_ids = denops#request('claudecode', 'listSessions', [])

  if empty(session_ids)
    echo 'No active Claude Code sessions'
    return
  endif

  echo 'Active Claude Code sessions:'
  for id in session_ids
    let info = denops#request('claudecode', 'getSessionInfo', [id])
    if !empty(info)
      echo printf('  %s: Model=%s Buffer=%d', id, info.model, info.bufnr)
    endif
  endfor
endfunction

" Switch to a different session
function! claudecode#switch_session(session_id) abort
  try
    call denops#request('claudecode', 'setCurrentSession', [a:session_id])
    let session_info = denops#request('claudecode', 'getSessionInfo', [a:session_id])
    
    if !empty(session_info)
      " Switch to the session's buffer
      execute 'buffer' session_info.bufnr
      echo 'Switched to session: ' . a:session_id
    else
      echoerr 'Session not found: ' . a:session_id
    endif
  catch
    echoerr 'Error switching session: ' . v:exception
  endtry
endfunction

" Switch model for current session
function! claudecode#switch_model(model) abort
  let current_session = denops#request('claudecode', 'getCurrentSession', [])
  if empty(current_session)
    echoerr 'No active Claude Code session'
    return
  endif

  call denops#notify('claudecode', 'switchModel', [current_session, a:model])
endfunction

" Get current session info
function! claudecode#get_current_session() abort
  return denops#request('claudecode', 'getCurrentSession', [])
endfunction

" Get session info
function! claudecode#get_session_info(session_id) abort
  let info = denops#request('claudecode', 'getSessionInfo', [a:session_id])
  return !empty(info) ? info : {}
endfunction

let &cpo = s:save_cpo
unlet s:save_cpo