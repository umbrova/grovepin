<script lang="ts">
  import { onMount } from 'svelte'
  import type { Session } from '$types/index'
  import { PLATFORM_LABEL, PLATFORM_COLOR, formatTimestamp } from '$lib/video'
  import { downloadMarkdown } from '$lib/export'

  let sessions:   Session[] = []
  let query       = ''
  let expandedId: string | null = null
  let loading     = true
  let copiedId:   string | null = null  // tracks which session link was just copied

  let needsReload = false

  onMount(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        try { await chrome.tabs.sendMessage(tab.id, { type: 'PING' }) }
        catch { needsReload = true }
      }
    } catch { /* ignore */ }

        // Purge 0-pin sessions from storage immediately
    await chrome.runtime.sendMessage({ type: 'PURGE_EMPTY_SESSIONS' })

    const res = await chrome.runtime.sendMessage({ type: 'GET_ALL_SESSIONS' })
    if (res.ok) {
      const all = Object.values(res.data as Record<string, Session>)
      // FIX: deduplicate by URL — keep the one with most pins
      const byUrl = new Map<string, Session>()
      for (const s of all) {
        const existing = byUrl.get(s.videoUrl)
        if (!existing || s.pins.length > existing.pins.length) {
          byUrl.set(s.videoUrl, s)
        }
      }
      sessions = Array.from(byUrl.values())
        .filter(s => s.pins.length > 0)  // hide empty sessions
        .sort((a, b) => b.updatedAt - a.updatedAt)
    }
    loading = false
  })

  $: totalPins      = sessions.reduce((n, s) => n + s.pins.length, 0)
  $: totalPlatforms = new Set(sessions.map(s => s.platform)).size

  interface SearchHit { session: Session; pinText: string; timestamp: number }
  $: searchHits = query.trim().length < 2
    ? []
    : sessions.flatMap(s =>
        s.pins
          .filter(p => p.text.toLowerCase().includes(query.toLowerCase()))
          .map(p => ({ session: s, pinText: p.text, timestamp: p.timestamp }))
      ) as SearchHit[]

  function highlight(text: string, q: string): string {
    if (!q) return text
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return text.replace(re, '<mark>$1</mark>')
  }

  function relativeTime(ts: number): string {
    const diff = Date.now() - ts
    const d    = Math.floor(diff / 86400000)
    if (d === 0) return 'today'
    if (d === 1) return 'yesterday'
    return `${d}d ago`
  }

  function toggleExpand(id: string) {
    expandedId = expandedId === id ? null : id
  }

  function openSettings() { chrome.runtime.openOptionsPage() }

  function openFeedback() {
    window.open('mailto:sylvoralabs@gmail.com?subject=Grovepin Feedback')
  }

  async function deleteSession(session: Session) {
    await chrome.runtime.sendMessage({ type: 'DELETE_SESSION', payload: { sessionId: session.id } })
    sessions = sessions.filter(s => s.id !== session.id)
    if (expandedId === session.id) expandedId = null
  }

  async function copyLink(session: Session) {
    try {
      await navigator.clipboard.writeText(session.videoUrl)
      copiedId = session.id
      setTimeout(() => { if (copiedId === session.id) copiedId = null }, 2500)
    } catch { /* silent fail */ }
  }
</script>

<div class="popup">

  <header>
    <svg class="logo" viewBox="0 0 32 32" fill="none">
      <rect x="2" y="9" width="28" height="17" rx="3" fill="#97C459" fill-opacity="0.2"/>
      <rect x="2" y="9" width="28" height="17" rx="3" stroke="#3B6D11" stroke-width="1.5"/>
      <circle cx="14" cy="17.5" r="2" fill="#3B6D11"/>
      <line x1="14" y1="9" x2="14" y2="26" stroke="#3B6D11" stroke-width="1" stroke-dasharray="2 2" stroke-opacity="0.5"/>
      <line x1="14" y1="2" x2="14" y2="9" stroke="#3B6D11" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="10.5" y1="4.5" x2="14" y2="3" stroke="#3B6D11" stroke-width="1" stroke-linecap="round"/>
      <line x1="17.5" y1="4.5" x2="14" y2="3" stroke="#3B6D11" stroke-width="1" stroke-linecap="round"/>
    </svg>
    <span class="title">Grovepin</span>
    <button class="icon-btn" on:click={openSettings} aria-label="Settings">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
    </button>
  </header>

  {#if needsReload}
  <div class="reload-banner">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    Reload this tab to activate Grovepin
    <button class="reload-btn" on:click={() => { chrome.tabs.reload(); window.close() }}>Reload</button>
  </div>
  {/if}

  {#if sessions.length > 0}
  <div class="stats-bar">
    <span class="stat"><span class="dot" style="background:#D85A30"></span>{sessions.length} sessions</span>
    <span class="stat"><span class="dot" style="background:#1D9E75"></span>{totalPins} {totalPins === 1 ? 'pin' : 'pins'}</span>
    <span class="stat"><span class="dot" style="background:#7F77DD"></span>{totalPlatforms} platforms</span>
  </div>
  {/if}

  <div class="search-wrap">
    <div class="search-row" class:active={query.length > 0}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="text" placeholder="Search notes and sessions…" bind:value={query} class="search-input"/>
      {#if query}
        <button class="clear-btn" on:click={() => query = ''} aria-label="Clear">×</button>
      {/if}
    </div>
  </div>

  <!-- FIX: scrollable content area with max-height -->
  <div class="content">

    {#if loading}
      <div class="empty"><p class="muted">Loading…</p></div>

    {:else if query.trim().length >= 2}
      <p class="section-label">{searchHits.length} match{searchHits.length !== 1 ? 'es' : ''}</p>
      {#if searchHits.length === 0}
        <div class="empty"><p class="muted">No notes match "{query}"</p></div>
      {:else}
        {#each searchHits as hit}
          <div class="result-row">
            <div class="dot small" style="background:{PLATFORM_COLOR[hit.session.platform]}"></div>
            <div class="result-info">
              <p class="result-context">{hit.session.videoTitle} · <strong>{formatTimestamp(hit.timestamp)}</strong></p>
              <p class="result-text">{@html highlight(hit.pinText, query)}</p>
            </div>
          </div>
        {/each}
      {/if}

    {:else if sessions.length === 0}
      <div class="empty">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" class="empty-icon"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
        <p class="empty-text">Your grove is empty.<br>Open any video and press <kbd>N</kbd> to pin your first moment.</p>
        <button class="close-btn" on:click={() => window.close()}>Close</button>
      </div>

    {:else}
      <p class="section-label">Recent sessions</p>
      {#each sessions as session (session.id)}
        <button class="session-row" on:click={() => toggleExpand(session.id)}>
          <div class="session-top">
            <div class="dot" style="background:{PLATFORM_COLOR[session.platform]}"></div>
            <div class="session-info">
              <p class="session-title">{session.videoTitle}</p>
              <div class="session-meta">
                <span class="platform">{PLATFORM_LABEL[session.platform]}</span>
                <span class="pin-count">{session.pins.length} {session.pins.length === 1 ? 'pin' : 'pins'}</span>
                <span class="time">{relativeTime(session.updatedAt)}</span>
              </div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron" class:open={expandedId === session.id}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </button>

        {#if expandedId === session.id}
          <div class="expanded">
            {#each session.pins.slice(0, 3) as pin}
              <div class="exp-pin">
                <span class="exp-ts">{formatTimestamp(pin.timestamp)}</span>
                <span class="exp-text">{pin.text}</span>
              </div>
            {/each}
            {#if session.pins.length > 3}
              <p class="exp-more">+ {session.pins.length - 3} more pins</p>
            {/if}
            <div class="exp-actions">
              <!-- FIX: copy link with visual feedback -->
              <button class="action-btn" class:copied={copiedId === session.id} on:click|stopPropagation={() => copyLink(session)}>
                {#if copiedId === session.id}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Copied!
                {:else}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  Copy link
                {/if}
              </button>
              <button class="action-btn primary" on:click|stopPropagation={() => downloadMarkdown(session)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export
              </button>
              <button class="action-btn danger" on:click|stopPropagation={() => deleteSession(session)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Delete
              </button>
            </div>
          </div>
        {/if}
      {/each}

      {#if sessions.length > 4}
        <div class="view-all"><span>View all {sessions.length} sessions →</span></div>
      {/if}
    {/if}

  </div>

  <!-- Footer -->
  <footer>
    <span class="copyright">© 2026 Sylvora Labs</span>
    <button class="feedback-btn" on:click={openFeedback} title="Send feedback">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
      Feedback
    </button>
  </footer>
</div>

<style>
  .popup { width: 280px; font-family: system-ui, sans-serif; background: #fff; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; max-height: 480px; }
  header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 0.5px solid #e8e8e6; flex-shrink: 0; }
  .logo { width: 16px; height: 16px; flex-shrink: 0; }
  .title { font-size: 12px; font-weight: 500; color: #1a1a18; flex: 1; }
  .icon-btn { background: none; border: none; cursor: pointer; color: #888; padding: 2px; display: flex; }
  .icon-btn:hover { color: #3B6D11; }
  .stats-bar { display: flex; align-items: center; gap: 12px; padding: 5px 14px; background: #f5f5f3; border-bottom: 0.5px solid #e8e8e6; flex-shrink: 0; }
  .stat { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #5a5a58; }
  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .dot.small { width: 6px; height: 6px; margin-top: 3px; }
  .search-wrap { padding: 7px 14px; border-bottom: 0.5px solid #e8e8e6; flex-shrink: 0; }
  .search-row { display: flex; align-items: center; gap: 7px; background: #f5f5f3; border-radius: 6px; padding: 5px 9px; border: 0.5px solid #e8e8e6; color: #888; }
  .search-row.active { border-color: #3B6D11; color: #3B6D11; }
  .search-input { font-size: 12px; color: #1a1a18; background: transparent; border: none; outline: none; flex: 1; font-family: inherit; }
  .search-input::placeholder { color: #aaa; }
  .clear-btn { background: none; border: none; cursor: pointer; color: #aaa; font-size: 14px; line-height: 1; padding: 0; }

  /* FIX: scrollable content area — scrollbar after 3 sessions */
  .content { overflow-y: auto; flex: 1; max-height: 320px; }

  .section-label { font-size: 9px; font-weight: 500; color: #aaa; text-transform: uppercase; letter-spacing: 0.07em; padding: 7px 14px 3px; }

  /* FIX: session-row as button — resets default button styles */
  .session-row { width: 100%; padding: 7px 14px; cursor: pointer; border: none; border-bottom: 0.5px solid #e8e8e6; background: transparent; text-align: left; font-family: inherit; }
  .session-row:hover { background: #f5f5f3; }
  .session-top { display: flex; align-items: center; gap: 8px; }
  .session-info { flex: 1; min-width: 0; }
  .session-title { font-size: 12px; font-weight: 500; color: #1a1a18; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 1px; }
  .session-meta { display: flex; align-items: center; gap: 5px; }
  .platform { font-size: 9px; color: #aaa; }
  .pin-count { font-size: 9px; font-weight: 500; padding: 1px 5px; border-radius: 99px; background: #EAF3DE; color: #27500A; }
  .time { font-size: 9px; color: #aaa; margin-left: auto; }
  .chevron { color: #bbb; flex-shrink: 0; margin-left: 6px; transition: transform 0.15s; }
  .chevron.open { transform: rotate(180deg); }

  .expanded { background: #f5f5f3; padding: 6px 14px 8px 28px; border-bottom: 0.5px solid #e8e8e6; }
  .exp-pin { display: flex; align-items: flex-start; gap: 6px; padding: 3px 0; }
  .exp-ts { font-size: 8px; font-weight: 500; padding: 1px 4px; border-radius: 2px; background: #3B6D11; color: #EAF3DE; flex-shrink: 0; margin-top: 2px; white-space: nowrap; }
  .exp-text { font-size: 10px; color: #5a5a58; line-height: 1.4; }
  .exp-more { font-size: 9px; color: #aaa; padding: 3px 0; }
  .exp-actions { display: flex; gap: 5px; margin-top: 7px; }
  .action-btn { display: inline-flex; align-items: center; gap: 3px; font-size: 9px; padding: 3px 7px; border: 0.5px solid #ddd; border-radius: 4px; background: transparent; color: #5a5a58; cursor: pointer; font-family: inherit; flex: 1; justify-content: center; transition: all 0.15s; }
  .action-btn.danger { border-color: #f0c0b0; color: #D85A30; }
  .action-btn.danger:hover { border-color: #D85A30; background: #FEF0EB; }
  .action-btn:hover { border-color: #aaa; }
  /* FIX: copy link copied state */
  .action-btn.copied { border-color: #3B6D11; color: #27500A; background: #EAF3DE; }
  .action-btn.primary { border-color: #3B6D11; color: #27500A; background: #EAF3DE; font-weight: 500; }
  .action-btn.primary:hover { background: #C0DD97; }

  .result-row { display: flex; align-items: flex-start; gap: 8px; padding: 7px 14px; border-bottom: 0.5px solid #e8e8e6; cursor: pointer; }
  .result-row:hover { background: #f5f5f3; }
  .result-info { flex: 1; min-width: 0; }
  .result-context { font-size: 9px; color: #aaa; margin-bottom: 2px; }
  .result-context strong { color: #888; }
  .result-text { font-size: 12px; color: #1a1a18; line-height: 1.4; }
  .result-text :global(mark) { background: #EAF3DE; color: #27500A; border-radius: 2px; padding: 0 2px; }

  .empty { padding: 28px 14px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .empty-icon { color: #ccc; }
  .empty-text { font-size: 12px; color: #aaa; line-height: 1.5; }
  .empty-text :global(kbd) { background: #f0f0ee; padding: 1px 5px; border-radius: 3px; border: 0.5px solid #ddd; font-size: 10px; }
  .muted { font-size: 12px; color: #aaa; padding: 20px 0; }
  .reload-banner { display: flex; align-items: center; gap: 6px; padding: 6px 14px; background: #FFF8E6; border-bottom: 0.5px solid #F0D080; font-size: 10px; color: #854F0B; flex-shrink: 0; }
  .reload-btn { margin-left: auto; font-size: 10px; padding: 2px 8px; border: 0.5px solid #BA7517; border-radius: 3px; background: transparent; color: #854F0B; cursor: pointer; font-family: inherit; white-space: nowrap; }
  .reload-btn:hover { background: #FFF0CC; }
  .close-btn { font-size: 10px; padding: 4px 10px; border: 0.5px solid #ddd; border-radius: 4px; background: transparent; color: #888; cursor: pointer; }
  .view-all { padding: 7px 14px; text-align: center; border-top: 0.5px solid #e8e8e6; font-size: 10px; color: #aaa; cursor: pointer; }
  footer { border-top: 0.5px solid #e8e8e6; padding: 5px 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; }
  .copyright { font-size: 10px; color: #ccc; }
  .feedback-btn { background: none; border: none; cursor: pointer; font-size: 10px; color: #aaa; font-family: inherit; padding: 0; display: inline-flex; align-items: center; gap: 4px; }
  .feedback-btn:hover { color: #3B6D11; }
</style>