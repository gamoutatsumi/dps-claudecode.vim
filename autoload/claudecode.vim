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

" Session management
let s:sessions = {}
let s:current_session = ''

" Start a new Claude Code session
function! claudecode#start(...) abort
  let model = a:0 > 0 ? a:1 : 'sonnet'

  " Create a new buffer for the session
  let bufnr = claudecode#buffer#create()

  " Start session via denops
  let session_id = denops#request('claudecode', 'startSession', [bufnr, model])

  " Store session info
  let s:sessions[session_id] = {
        \ 'bufnr': bufnr,
        \ 'model': model,
        \ }
  let s:current_session = session_id

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
  if empty(s:current_session)
    echoerr 'No active Claude Code session. Use :ClaudeCodeStart to begin.'
    return
  endif

  let session = s:sessions[s:current_session]

  " Append user message to buffer
  call claudecode#buffer#append_line(session.bufnr, 'You: ' . a:message)

  " Send message via denops
  call denops#notify('claudecode', 'sendMessage', [s:current_session, a:message])
endfunction

" End the current session
function! claudecode#end() abort
  if empty(s:current_session)
    echoerr 'No active Claude Code session'
    return
  endif

  call denops#notify('claudecode', 'endSession', [s:current_session])

  " Clean up
  if has_key(s:sessions, s:current_session)
    unlet s:sessions[s:current_session]
  endif
  let s:current_session = ''

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
  if !has_key(s:sessions, a:session_id)
    echoerr 'Invalid session ID: ' . a:session_id
    return
  endif

  let s:current_session = a:session_id
  let session = s:sessions[a:session_id]

  " Switch to the session's buffer
  execute 'buffer' session.bufnr

  echo 'Switched to session: ' . a:session_id
endfunction

" Switch model for current session
function! claudecode#switch_model(model) abort
  if empty(s:current_session)
    echoerr 'No active Claude Code session'
    return
  endif

  call denops#notify('claudecode', 'switchModel', [s:current_session, a:model])
  let s:sessions[s:current_session].model = a:model
endfunction

" Get current session info
function! claudecode#get_current_session() abort
  return s:current_session
endfunction

" Get session info
function! claudecode#get_session_info(session_id) abort
  return has_key(s:sessions, a:session_id) ? s:sessions[a:session_id] : {}
endfunction

let &cpo = s:save_cpo
unlet s:save_cpo