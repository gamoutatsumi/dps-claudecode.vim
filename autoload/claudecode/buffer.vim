" Buffer management for Claude Code sessions

let s:save_cpo = &cpo
set cpo&vim

" Create a new buffer for Claude Code session
function! claudecode#buffer#create() abort
  " Create a new buffer
  enew
  let bufnr = bufnr('%')

  " Set buffer options
  setlocal buftype=prompt
  setlocal bufhidden=hide
  setlocal noswapfile
  setlocal nobuflisted
  setlocal nospell
  setlocal nonumber
  setlocal norelativenumber
  setlocal wrap
  setlocal linebreak
  setlocal filetype=claudecode

  " Set buffer name
  execute 'file ClaudeCode-' . bufnr

  return bufnr
endfunction

" Setup buffer for Claude Code session
function! claudecode#buffer#setup(bufnr, session_id) abort
  let current_buf = bufnr('%')
  execute 'buffer' a:bufnr

  " Set prompt
  if has('nvim')
    call prompt_setprompt(a:bufnr, '> ')
    call prompt_setcallback(a:bufnr, function('s:on_prompt_submit', [a:session_id]))
  else
    set prompt=>\
    " For Vim, we'll use autocmd for handling input
    augroup ClaudeCodePrompt
      autocmd!
      autocmd BufEnter <buffer> call s:setup_vim_prompt(a:session_id)
    augroup END
  endif

  " Set buffer-local mappings
  nnoremap <buffer> <silent> q :call claudecode#end()<CR>
  nnoremap <buffer> <silent> <C-c> :call claudecode#end()<CR>

  " Return to original buffer if different
  if current_buf != a:bufnr
    execute 'buffer' current_buf
  endif
endfunction

" Append a line to the buffer
function! claudecode#buffer#append_line(bufnr, text) abort
  let current_buf = bufnr('%')
  execute 'buffer' a:bufnr

  " Move to the end of buffer
  normal! G

  " If we're in a prompt buffer, we need to handle it differently
  if getbufvar(a:bufnr, '&buftype') == 'prompt'
    " For prompt buffers, append before the prompt line
    if has('nvim')
      call append(line('$') - 1, a:text)
    else
      call append(line('$'), a:text)
    endif
  else
    call append(line('$'), a:text)
  endif

  " Move to the end
  normal! G

  " Return to original buffer if different
  if current_buf != a:bufnr
    execute 'buffer' current_buf
  endif
endfunction

" Append multiple lines to the buffer (for performance)
function! claudecode#buffer#append_lines(bufnr, lines) abort
  let current_buf = bufnr('%')
  execute 'buffer' a:bufnr

  " Move to the end of buffer
  normal! G

  " If we're in a prompt buffer, we need to handle it differently
  if getbufvar(a:bufnr, '&buftype') == 'prompt'
    " For prompt buffers, append before the prompt line
    if has('nvim')
      call append(line('$') - 1, a:lines)
    else
      call append(line('$'), a:lines)
    endif
  else
    call append(line('$'), a:lines)
  endif

  " Move to the end
  normal! G

  " Return to original buffer if different
  if current_buf != a:bufnr
    execute 'buffer' current_buf
  endif
endfunction

" Replace the last line in the buffer
function! claudecode#buffer#replace_last_line(bufnr, text) abort
  let current_buf = bufnr('%')
  execute 'buffer' a:bufnr

  " Get the last non-prompt line
  if getbufvar(a:bufnr, '&buftype') == 'prompt'
    if has('nvim')
      let last_line = line('$') - 1
    else
      let last_line = line('$')
    endif
  else
    let last_line = line('$')
  endif

  if last_line > 0
    call setline(last_line, a:text)
  endif

  " Return to original buffer if different
  if current_buf != a:bufnr
    execute 'buffer' current_buf
  endif
endfunction

" Handle prompt submission
function! s:on_prompt_submit(session_id, text) abort
  if !empty(a:text)
    call claudecode#send_message(a:text)
  endif
endfunction

" Setup Vim-specific prompt handling
function! s:setup_vim_prompt(session_id) abort
  " For Vim without prompt buffer support
  " Use input() to get user input
  nnoremap <buffer> <silent> i :call <SID>vim_prompt_input(a:session_id)<CR>
  nnoremap <buffer> <silent> a :call <SID>vim_prompt_input(a:session_id)<CR>
  nnoremap <buffer> <silent> o :call <SID>vim_prompt_input(a:session_id)<CR>
  nnoremap <buffer> <silent> <CR> :call <SID>vim_prompt_input(a:session_id)<CR>
endfunction

" Get input for Vim without prompt buffer
function! s:vim_prompt_input(session_id) abort
  let input = input('> ')
  if !empty(input)
    call claudecode#send_message(input)
  endif
  redraw
endfunction

let &cpo = s:save_cpo
unlet s:save_cpo