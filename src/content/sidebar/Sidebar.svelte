<script lang="ts">
  import { onMount } from 'svelte'
  import type { Session, Pin, SummaryResult, UserSettings } from '$types/index'
  import { formatTimestamp, pauseVideo, resumeVideo, seekTo, getVideoProgress } from '$lib/video'
  import { generateId } from '$lib/storage'
  import { downloadMarkdown } from '$lib/export'

  export let session: Session
  export let settings: UserSettings

  const MAX_PINS = 50
  const PINS_WARNING = 45

  type Screen = 'empty' | 'list' | 'compose' | 'edit' | 'summary'
  let screen: Screen    = 'empty'
  let collapsed         = false   // pill vs full sidebar

  let pins: Pin[]           = []
  let activePin: Pin | null = null
  let noteText              = ''
  let pinnedTime            = 0
  let progress              = 0
  let summary: SummaryResult | null = null
  let summarising           = false
  let summaryError          = ''
  let copyLinkState: 'idle' | 'copied' | 'error' = 'idle'
  let copySummaryDone       = false

  $: threshold           = settings.summariseThreshold ?? 7
  $: pinsLeft            = Math.max(0, threshold - pins.length)
  $: pinWord              = (n: number) => n === 1 ? 'pin' : 'pins'
  $: hasSummary          = summary !== null
  $: newPinsSinceSummary = session.lastSummarisedAt
    ? pins.some(p => p.createdAt > (session.lastSummarisedAt ?? 0))
    : false
  $: canSummarise        = pins.length >= threshold && (!session.lastSummarisedAt || newPinsSinceSummary)
  $: canViewSummary      = (hasSummary || !!session.summary) && !newPinsSinceSummary
  $: atPinLimit          = pins.length >= MAX_PINS
  $: nearPinLimit        = pins.length >= PINS_WARNING && !atPinLimit
  $: isLimitError        = summaryError.toLowerCase().includes('limit')
    || summaryError.toLowerCase().includes('quota')
    || summaryError.toLowerCase().includes('rate')

  let sidebarEl: HTMLElement
  let pillEl: HTMLElement

  $: if (sidebarEl) {
    if (settings.theme === 'dark') {
      sidebarEl.setAttribute('data-theme', 'dark')
    } else if (settings.theme === 'light') {
      sidebarEl.setAttribute('data-theme', 'light')
    } else {
      sidebarEl.removeAttribute('data-theme')
    }
  }

  $: if (pillEl) {
    if (settings.theme === 'dark') {
      pillEl.setAttribute('data-theme', 'dark')
    } else if (settings.theme === 'light') {
      pillEl.setAttribute('data-theme', 'light')
    } else {
      pillEl.removeAttribute('data-theme')
    }
  }

  onMount(() => {
    chrome.runtime.sendMessage({ type: 'GET_SESSION', payload: { sessionId: session.id } })
      .then(res => {
        if (res.ok && res.data) {
          pins    = res.data.pins ?? []
          // FIX: always use fresh title from page, not stored one
          session = { ...res.data, videoTitle: session.videoTitle, videoUrl: session.videoUrl }
          // Restore persisted AI summary — otherwise it's lost on every reload
          if (!summary && session.summary) summary = session.summary
        } else {
          chrome.runtime.sendMessage({ type: 'SAVE_SESSION', payload: { session } })
        }
        screen = pins.length > 0 ? 'list' : 'empty'
      })

    const interval = setInterval(() => { progress = getVideoProgress() }, 1000)

    // N key — pin moment
    const onPin = () => openCompose()
    document.addEventListener('grovepin:pin', onPin)

    // Ctrl+Shift+H — toggle sidebar (fired from background via content/index.ts)
    const onToggle = () => { collapsed = !collapsed }
    document.addEventListener('grovepin:toggle', onToggle)

    return () => {
      clearInterval(interval)
      document.removeEventListener('grovepin:pin', onPin)
      document.removeEventListener('grovepin:toggle', onToggle)
    }
  })

  function openCompose() {
    if (atPinLimit) return  // silently block — UI already shows message
    if (collapsed) collapsed = false   // auto-expand when pinning
    pinnedTime = document.querySelector('video')?.currentTime ?? 0
    pauseVideo()
    noteText = ''; activePin = null; screen = 'compose'
    setTimeout(() => (document.querySelector('.gp-textarea') as HTMLTextAreaElement)?.focus(), 50)
  }

  async function savePin() {
    if (!noteText.trim()) { cancelCompose(); return }

    // FIX: read title on first pin save — page is fully loaded by now
    if (!session.videoTitle) {
      const freshTitle = document.title
        .replace(/ - YouTube$/i, '')
        .replace(/ \| .*$/, '')
        .trim() || document.querySelector('h1')?.textContent?.trim() || 'Untitled video'
      session = { ...session, videoTitle: freshTitle }
      // Persist updated title
      await chrome.runtime.sendMessage({ type: 'SAVE_SESSION', payload: { session } })
    }

    const pin: Pin = activePin
      ? { ...activePin, text: noteText.trim(), updatedAt: Date.now() }
      : { id: generateId(), timestamp: pinnedTime, text: noteText.trim(), createdAt: Date.now(), updatedAt: Date.now() }
    if (activePin) {
      await chrome.runtime.sendMessage({ type: 'UPDATE_PIN', payload: { sessionId: session.id, pin } })
      pins = pins.map(p => p.id === pin.id ? pin : p)
    } else {
      await chrome.runtime.sendMessage({ type: 'SAVE_PIN', payload: { sessionId: session.id, pin } })
      pins = [...pins, pin].sort((a, b) => a.timestamp - b.timestamp)
    }
    resumeVideo(); activePin = null; noteText = ''; screen = 'list'
  }

  function cancelCompose() {
    resumeVideo(); activePin = null; noteText = ''
    screen = pins.length > 0 ? 'list' : 'empty'
  }

  function openEdit(pin: Pin) {
    pauseVideo()
    activePin = pin; noteText = pin.text; pinnedTime = pin.timestamp; screen = 'edit'
    setTimeout(() => { const ta = document.querySelector('.gp-textarea') as HTMLTextAreaElement; if (ta) { ta.focus(); ta.select() } }, 50)
  }

  function jumpToPin() { seekTo(pinnedTime); resumeVideo() }

  async function deletePin(pin: Pin) {
    await chrome.runtime.sendMessage({ type: 'DELETE_PIN', payload: { sessionId: session.id, pinId: pin.id } })
    pins = pins.filter(p => p.id !== pin.id)
    if (pins.length === 0) {
      summary = null
      session = { ...session, summary: null, lastSummarisedAt: null }
    }
    resumeVideo()
    screen = pins.length > 0 ? 'list' : 'empty'
  }

  async function summarise() {
    // If summary cached and no new pins — just show it, no API call
    if (canViewSummary) {
      if (!summary && session.summary) summary = session.summary
      screen = 'summary'
      return
    }
    if (!canSummarise) return

    summarising = true; summaryError = ''; screen = 'summary'
    const res = await chrome.runtime.sendMessage({ type: 'SUMMARISE', payload: { sessionId: session.id } })
    summarising = false
    if (res.ok) {
      summary = res.data.summary
      session = { ...session, lastSummarisedAt: res.data.lastSummarisedAt }
    } else {
      summaryError = res.error
    }
  }

  async function copySummary() {
    if (!summary) return
    const text = [summary.overview, '', 'Key points:', ...summary.keyPoints.map((p: string) => `• ${p}`), ...(summary.revisit.length ? ['', 'Revisit:', ...summary.revisit.map((r: {timestamp:number;note:string}) => `→ [${formatTimestamp(r.timestamp)}] ${r.note}`)] : [])].join('\n')
    await navigator.clipboard.writeText(text)
    copySummaryDone = true; setTimeout(() => copySummaryDone = false, 2000)
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(session.videoUrl); copyLinkState = 'copied' }
    catch { copyLinkState = 'error' }
    setTimeout(() => copyLinkState = 'idle', 2500)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && (screen === 'compose' || screen === 'edit')) cancelCompose()
    if (e.key === 'Enter' && !e.shiftKey && (screen === 'compose' || screen === 'edit')) { e.preventDefault(); savePin() }
  }
</script>

<svelte:window on:keydown={handleKeydown}/>

<!-- ── COLLAPSED PILL ────────────────────────────────────────────────────── -->
{#if collapsed}
  <button class="gp-pill" bind:this={pillEl} on:click={() => collapsed = false} title="Open Grovepin (Ctrl+Shift+H)">
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
      <rect x="2" y="9" width="28" height="17" rx="3" fill="#EAF3DE" fill-opacity="0.3"/>
      <rect x="2" y="9" width="28" height="17" rx="3" stroke="#EAF3DE" stroke-width="1.5"/>
      <circle cx="14" cy="17.5" r="2" fill="#EAF3DE"/>
      <line x1="14" y1="9" x2="14" y2="26" stroke="#EAF3DE" stroke-width="1" stroke-dasharray="2 2" stroke-opacity="0.5"/>
      <line x1="14" y1="2" x2="14" y2="9" stroke="#EAF3DE" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="10.5" y1="4.5" x2="14" y2="3" stroke="#EAF3DE" stroke-width="1" stroke-linecap="round"/>
      <line x1="17.5" y1="4.5" x2="14" y2="3" stroke="#EAF3DE" stroke-width="1" stroke-linecap="round"/>
      <line x1="11" y1="7" x2="14" y2="5.5" stroke="#EAF3DE" stroke-width="1" stroke-linecap="round"/>
      <line x1="17" y1="7" x2="14" y2="5.5" stroke="#EAF3DE" stroke-width="1" stroke-linecap="round"/>
    </svg>
    {#if pins.length > 0}
      <span class="gp-pill-count">{pins.length}</span>
    {/if}
    <span class="gp-pill-arrow">◀</span>
  </button>

<!-- ── FULL SIDEBAR ──────────────────────────────────────────────────────── -->
{:else}
<aside class="gp-sidebar" bind:this={sidebarEl}>

  <header class="gp-header">
    {#if screen === 'compose'}
      <span class="gp-title">New pin</span>
      <span class="gp-badge paused">⏸ paused</span>
    {:else if screen === 'edit'}
      <span class="gp-title">Edit pin</span>
      <button class="gp-danger-btn" on:click={() => activePin && deletePin(activePin)}>🗑 Delete</button>
    {:else if screen === 'summary'}
      <span class="gp-title">Summary</span>
      <button class="gp-icon-btn" on:click={copySummary}>{copySummaryDone ? '✓ Copied' : '⎘ Copy'}</button>
    {:else}
      <svg class="gp-logo" viewBox="0 0 32 32" fill="none"><rect x="2" y="9" width="28" height="17" rx="3" fill="#97C459" fill-opacity="0.2"/><rect x="2" y="9" width="28" height="17" rx="3" stroke="#3B6D11" stroke-width="1.5"/><circle cx="14" cy="17.5" r="2" fill="#3B6D11"/><line x1="14" y1="9" x2="14" y2="26" stroke="#3B6D11" stroke-width="1" stroke-dasharray="2 2" stroke-opacity="0.5"/><line x1="14" y1="2" x2="14" y2="9" stroke="#3B6D11" stroke-width="1.3" stroke-linecap="round"/><line x1="10.5" y1="4.5" x2="14" y2="3" stroke="#3B6D11" stroke-width="1" stroke-linecap="round"/><line x1="17.5" y1="4.5" x2="14" y2="3" stroke="#3B6D11" stroke-width="1" stroke-linecap="round"/><line x1="11" y1="7" x2="14" y2="5.5" stroke="#3B6D11" stroke-width="1" stroke-linecap="round"/><line x1="17" y1="7" x2="14" y2="5.5" stroke="#3B6D11" stroke-width="1" stroke-linecap="round"/></svg>
      <span class="gp-title">Grovepin</span>
      {#if pins.length > 0}<span class="gp-badge green">{pins.length} {pins.length === 1 ? 'pin' : 'pins'}</span>{/if}
      <button class="gp-icon-btn" on:click={() => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' })} title="Settings">⚙</button>
      <button class="gp-collapse-btn" on:click={() => collapsed = true} title="Hide sidebar (Ctrl+Shift+H)" aria-label="Collapse sidebar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/><polyline points="18 8 21 11 18 14"/></svg></button>
    {/if}
  </header>

  {#if screen === 'list' || screen === 'empty'}
    <div class="gp-meta">
      <p class="gp-vtitle">
        {#if session.videoTitle}
          {session.videoTitle}
        {:else}
          {new URL(session.videoUrl).hostname.replace('www.', '')}
        {/if}
      </p>
      <div class="gp-bar"><div class="gp-bar-fill" style="width:{progress * 100}%"></div></div>
    </div>
  {/if}

  {#if screen === 'empty'}
    <div class="gp-empty">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
      <p class="gp-empty-text">Press <kbd>N</kbd> to pin your first moment</p>
    </div>
    <div class="gp-footer">
      <div class="gp-pin-row" role="button" tabindex="0" on:click={openCompose} on:keydown={e => e.key === 'Enter' && openCompose()}>
        <span class="gp-pin-ts">{formatTimestamp(0)}</span>
        <span class="gp-pin-placeholder">Pin a moment…</span>
        <span class="gp-pin-hint">N</span>
      </div>
    </div>

  {:else if screen === 'list'}
    <div class="gp-notes">
      {#each pins as pin (pin.id)}
        <div class="gp-note-row" role="listitem" on:dblclick={() => openEdit(pin)}>
          <span class="gp-ts">{formatTimestamp(pin.timestamp)}</span>
          <span class="gp-note-text">{pin.text}</span>
          <div class="gp-note-actions">
            <button class="gp-action" on:click|stopPropagation={() => openEdit(pin)} title="Edit">✎</button>
            <button class="gp-action" on:click|stopPropagation={() => seekTo(pin.timestamp)} title="Jump to">▶</button>
            <button class="gp-action del" on:click|stopPropagation={() => deletePin(pin)} title="Delete">✕</button>
          </div>
        </div>
      {/each}
    </div>
    <div class="gp-footer">
      <div class="gp-pin-row" class:disabled={atPinLimit} role="button" tabindex="0" on:click={openCompose} on:keydown={e => e.key === 'Enter' && openCompose()}>
        <span class="gp-pin-ts">live</span>
        <span class="gp-pin-placeholder">Pin a moment…</span>
        <span class="gp-pin-hint">N</span>
      </div>
      {#if atPinLimit}
        <div class="gp-limit-msg error">
          Pin limit reached (50). Export your notes to continue.
        </div>
      {:else if nearPinLimit}
        <div class="gp-limit-msg warn">
          {MAX_PINS - pins.length} pins remaining before limit.
        </div>
      {/if}
      <div class="gp-footer-btns">
        <button
          class="gp-btn"
          class:disabled={!canSummarise && !canViewSummary}
          disabled={!canSummarise && !canViewSummary}
          title={canViewSummary ? 'View saved summary' : canSummarise ? 'Summarise with AI' : `${pinsLeft} more pins to unlock`}
          on:click={summarise}>
          ✦ {canViewSummary ? 'View summary' : 'Summarise'}
        </button>
        <button class="gp-btn" on:click={() => downloadMarkdown(session, summary)}>↓ Export</button>
      </div>
      {#if !canSummarise && !canViewSummary && pins.length < threshold}
        <p class="gp-unlock-hint">{pinsLeft} more pin{pinsLeft !== 1 ? 's' : ''} to unlock summarise</p>
      {/if}
    </div>

  {:else if screen === 'compose' || screen === 'edit'}
    <div class="gp-screen">
      <button class="gp-back" on:click={cancelCompose}>← back to notes</button>
      <div class="gp-ts-row">
        <span class="gp-ts">{formatTimestamp(pinnedTime)}</span>
        <span class="gp-screen-context">{session.videoTitle.slice(0, 26)}{session.videoTitle.length > 26 ? '…' : ''}</span>
        {#if screen === 'edit'}
          <button class="gp-jump-btn" on:click={jumpToPin}>▶ Jump to</button>
        {/if}
      </div>
      <textarea class="gp-textarea" placeholder="What caught your attention?" bind:value={noteText} rows="3"></textarea>
      <p class="gp-char-hint">Esc to cancel · Enter to save</p>
      <div class="gp-screen-btns">
        <button class="gp-btn" on:click={cancelCompose}>Cancel</button>
        <button class="gp-btn primary" on:click={savePin}>🌿 Pin it</button>
      </div>
    </div>

  {:else if screen === 'summary'}
    <div class="gp-screen">
      <button class="gp-back" on:click={() => screen = 'list'}>← back to notes</button>
      {#if summarising}
        <div class="gp-loading"><div class="gp-spinner"></div><p>Summarising your pins…</p></div>
      {:else if summaryError}
        {#if isLimitError}
          <div class="gp-error">
            <p>You've used your 10 free summaries this month.</p>
            <p style="margin-top:6px;font-size:11px;color:#888;line-height:1.5">
              Export your notes as Markdown and paste them into ChatGPT,
              Claude, or any AI to summarise. Resets on the 1st of next month.
            </p>
            <button class="gp-btn primary" style="margin-top:8px"
              on:click={() => downloadMarkdown(session, summary)}>
              ↓ Export notes
            </button>
          </div>
        {:else}
          <div class="gp-error"><p>{summaryError}</p><button class="gp-btn" on:click={() => screen = 'list'}>Go back</button></div>
        {/if}
      {:else if summary}
        <div class="gp-sum-section"><p class="gp-sum-label">Overview</p><p class="gp-sum-text">{summary.overview}</p></div>
        <div class="gp-divider"></div>
        <div class="gp-sum-section">
          <p class="gp-sum-label">Key points</p>
          {#each summary.keyPoints as point}
            <div class="gp-sum-item"><span class="gp-sum-dot">•</span><span class="gp-sum-text">{point}</span></div>
          {/each}
        </div>
        {#if summary.revisit.length > 0}
          <div class="gp-divider"></div>
          <div class="gp-sum-section">
            <p class="gp-sum-label">Revisit</p>
            {#each summary.revisit as item}
              <div class="gp-sum-item">
                <span class="gp-sum-dot">→</span>
                <span class="gp-sum-text"><button class="gp-ts-link" on:click={() => { seekTo(item.timestamp); resumeVideo() }}>{formatTimestamp(item.timestamp)}</button>{item.note}</span>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  {/if}

  {#if copyLinkState !== 'idle'}
    <div class="gp-toast" class:error={copyLinkState === 'error'}>
      {copyLinkState === 'copied' ? '✓ Link copied to clipboard' : '✗ Could not copy'}
    </div>
  {/if}

</aside>
{/if}

<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Pill ─────────────────────────────────────────────────────────────── */
  .gp-pill {
    position: fixed; top: 50%; right: 0;
    transform: translateY(-50%);
    width: 32px; background: #3B6D11;
    border-radius: 8px 0 0 8px;
    padding: 10px 6px;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    cursor: pointer; border: none;
    box-shadow: -2px 0 10px rgba(0,0,0,0.15);
    z-index: 2147483647;
    transition: width 0.15s ease;
  }
  .gp-pill:hover { width: 36px; background: #27500A; }
  .gp-pill-count {
    font-size: 9px; font-weight: 500; color: #EAF3DE;
    background: rgba(255,255,255,0.2); padding: 2px 5px;
    border-radius: 99px; line-height: 1;
  }
  .gp-pill-arrow { font-size: 8px; color: rgba(255,255,255,0.5); }

  /* ── Sidebar ──────────────────────────────────────────────────────────── */
  .gp-sidebar {
    position: fixed; top: 0; right: 0; width: 220px; height: 100vh;
    background: #fff; border-left: 0.5px solid #e8e8e6;
    font-family: system-ui, sans-serif;
    display: flex; flex-direction: column;
    font-size: 12px; color: #1a1a18;
    box-shadow: -2px 0 12px rgba(0,0,0,0.06);
    z-index: 2147483647;
    animation: slideIn 0.15s ease;
  }
  @keyframes slideIn { from { transform: translateX(220px); } to { transform: translateX(0); } }

  .gp-header { display: flex; align-items: center; gap: 7px; padding: 10px 12px; border-bottom: 0.5px solid #e8e8e6; flex-shrink: 0; }
  .gp-logo { width: 16px; height: 16px; flex-shrink: 0; }
  .gp-title { font-size: 12px; font-weight: 500; color: #1a1a18; flex: 1; }
  .gp-badge { font-size: 9px; font-weight: 500; padding: 1px 6px; border-radius: 99px; white-space: nowrap; }
  .gp-badge.green { background: #EAF3DE; color: #27500A; }
  .gp-badge.paused { background: #FFF0CC; color: #854F0B; }
  .gp-icon-btn { background: none; border: none; cursor: pointer; color: #aaa; font-size: 14px; padding: 3px 5px; line-height: 1; border-radius: 3px; font-family: inherit; }
  .gp-icon-btn:hover { color: #3B6D11; background: #EAF3DE; }
  .gp-collapse-btn { background: none; border: none; cursor: pointer; color: #ccc; padding: 2px 3px; line-height: 1; border-radius: 3px; display: flex; align-items: center; }
  .gp-collapse-btn:hover { color: #3B6D11; background: #EAF3DE; }
  .gp-danger-btn { font-size: 9px; padding: 2px 7px; border: 0.5px solid #D85A30; border-radius: 3px; background: transparent; color: #712B13; cursor: pointer; margin-left: auto; font-family: inherit; }

  .gp-meta { padding: 7px 12px; border-bottom: 0.5px solid #e8e8e6; flex-shrink: 0; }
  .gp-vtitle { font-size: 10px; color: #aaa; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gp-bar { height: 2.5px; background: #f0f0ee; border-radius: 99px; overflow: hidden; }
  .gp-bar-fill { height: 100%; background: #3B6D11; border-radius: 99px; opacity: 0.7; transition: width 1s linear; }

  .gp-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 20px; }
  .gp-empty-text { font-size: 12px; color: #aaa; text-align: center; line-height: 1.5; }
  .gp-empty-text kbd { background: #f0f0ee; padding: 1px 5px; border-radius: 3px; border: 0.5px solid #ddd; font-size: 10px; }

  .gp-notes { flex: 1; overflow-y: auto; }
  .gp-note-row { display: flex; align-items: flex-start; gap: 7px; padding: 6px 12px; border-bottom: 0.5px solid #e8e8e6; cursor: default; position: relative; }
  .gp-note-row:hover { background: #f5f5f3 !important; }
  .gp-note-row:hover .gp-note-actions { opacity: 1 !important; visibility: visible !important; }
  .gp-ts { font-size: 9px; font-weight: 500; padding: 2px 5px; border-radius: 3px; background: #3B6D11; color: #EAF3DE; white-space: nowrap; flex-shrink: 0; margin-top: 1px; }
  .gp-note-text { font-size: 12px; color: #1a1a18; line-height: 1.4; flex: 1; word-break: break-word; }
  .gp-note-actions { display: flex !important; gap: 4px; opacity: 0 !important; visibility: hidden !important; flex-shrink: 0; margin-top: 1px; transition: opacity 0.1s; }
  .gp-action { background: none !important; border: none !important; cursor: pointer !important; color: #bbb !important; font-size: 12px !important; padding: 2px 4px !important; line-height: 1 !important; border-radius: 3px !important; font-family: inherit !important; }
  .gp-action:hover { color: #3B6D11 !important; background: #EAF3DE !important; }
  .gp-action.del:hover { color: #D85A30 !important; background: #FEF0EB !important; }

  .gp-footer { padding: 8px 12px; border-top: 0.5px solid #e8e8e6; flex-shrink: 0; }
  .gp-pin-row { display: flex; align-items: center; gap: 6px; background: #f5f5f3; border-radius: 6px; padding: 6px 8px; border: 0.5px solid #e8e8e6; cursor: pointer; }
  .gp-pin-row:hover { border-color: #3B6D11; }
  .gp-pin-row.disabled { opacity: 0.5; cursor: not-allowed; }
  .gp-pin-row.disabled:hover { border-color: #e8e8e6; }
  .gp-pin-ts { font-size: 9px; font-weight: 500; padding: 2px 5px; border-radius: 3px; background: #3B6D11; color: #EAF3DE; flex-shrink: 0; }
  .gp-pin-placeholder { font-size: 10px; color: #aaa; flex: 1; }
  .gp-pin-hint { font-size: 9px; color: #ccc; }
  .gp-footer-btns { display: flex; gap: 5px; margin-top: 6px; }
  .gp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 3px; font-size: 10px; padding: 4px 8px; border: 0.5px solid #ddd; border-radius: 4px; background: transparent; color: #5a5a58; cursor: pointer; line-height: 1; font-family: inherit; flex: 1; }
  .gp-btn:hover { border-color: #3B6D11; color: #27500A; }
  .gp-btn.primary { border-color: #3B6D11; color: #27500A; background: #EAF3DE; font-weight: 500; }
  .gp-btn.primary:hover { background: #C0DD97; }
  .gp-btn.disabled { opacity: 0.35; cursor: not-allowed; }
  .gp-btn.disabled:hover { border-color: #ddd !important; color: #5a5a58 !important; }
  .gp-unlock-hint { font-size: 9px; color: #aaa; text-align: center; margin-top: 5px; }
  .gp-limit-msg { font-size: 9px; text-align: center; padding: 4px 8px; border-radius: 4px; margin-top: 4px; }
  .gp-limit-msg.warn  { background: #FFF8E6; color: #854F0B; }
  .gp-limit-msg.error { background: #FEF0EB; color: #D85A30; }

  .gp-screen { flex: 1; padding: 10px 12px; display: flex; flex-direction: column; overflow-y: auto; }
  .gp-back { background: none; border: none; cursor: pointer; font-size: 11px; color: #aaa; padding: 0; text-align: left; margin-bottom: 10px; font-family: inherit; }
  .gp-back:hover { color: #3B6D11; }
  .gp-ts-row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
  .gp-screen-context { font-size: 10px; color: #aaa; flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .gp-jump-btn { font-size: 9px; padding: 2px 6px; border: 0.5px solid #3B6D11; border-radius: 3px; background: transparent; color: #3B6D11; cursor: pointer; white-space: nowrap; font-family: inherit; }
  .gp-jump-btn:hover { background: #EAF3DE; }
  .gp-textarea { width: 100%; font-size: 12px; padding: 7px 8px; border: 0.5px solid #3B6D11; border-radius: 5px; background: #fff; color: #1a1a18; resize: none; line-height: 1.45; font-family: inherit; outline: none; margin-bottom: 2px; }
  .gp-textarea:focus { box-shadow: 0 0 0 2px #EAF3DE; }
  .gp-char-hint { font-size: 9px; color: #ccc; text-align: right; margin-bottom: 8px; }
  .gp-screen-btns { display: flex; gap: 5px; }

  .gp-sum-section { margin-bottom: 10px; }
  .gp-sum-label { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: #aaa; margin-bottom: 4px; }
  .gp-sum-text { font-size: 13px; color: #5a5a58; line-height: 1.5; }
  .gp-sum-item { display: flex; gap: 5px; margin-bottom: 3px; }
  .gp-sum-dot { color: #3B6D11; font-size: 13px; flex-shrink: 0; margin-top: 1px; }
  .gp-divider { height: 0.5px; background: #e8e8e6; margin: 0 0 8px; }
  .gp-ts-link { background: #EAF3DE; color: #27500A; font-size: 10px; padding: 1px 5px; border-radius: 3px; border: none; cursor: pointer; font-weight: 500; margin-right: 4px; font-family: inherit; }
  .gp-ts-link:hover { background: #C0DD97; }

  .gp-toast { position: absolute; bottom: 60px; left: 12px; right: 12px; background: #1a1a18; color: #fff; font-size: 10px; padding: 6px 10px; border-radius: 5px; text-align: center; animation: fadeIn 0.15s ease; z-index: 1; }
  .gp-toast.error { background: #D85A30; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  .gp-loading { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #aaa; font-size: 12px; }
  .gp-spinner { width: 18px; height: 18px; border: 2px solid #EAF3DE; border-top-color: #3B6D11; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .gp-error { padding: 10px; color: #D85A30; font-size: 12px; line-height: 1.5; display: flex; flex-direction: column; gap: 8px; }

  @media (prefers-color-scheme: dark) {
    .gp-pill:not([data-theme="light"]) { background: #0F6E56; }
    .gp-pill:not([data-theme="light"]):hover { background: #085041; }
    .gp-sidebar:not([data-theme="light"]) { background: #1f1f1f; border-color: #2e2e2e; color: #e8e6e0; }
    .gp-sidebar:not([data-theme="light"]) .gp-header, .gp-sidebar:not([data-theme="light"]) .gp-meta, .gp-sidebar:not([data-theme="light"]) .gp-footer { border-color: #2e2e2e; }
    .gp-sidebar:not([data-theme="light"]) .gp-note-row { border-color: #2e2e2e; }
    .gp-sidebar:not([data-theme="light"]) .gp-note-row:hover { background: #252525 !important; }
    .gp-sidebar:not([data-theme="light"]) .gp-bar { background: #2a2a2a; }
    .gp-sidebar:not([data-theme="light"]) .gp-pin-row { background: #2a2a2a; border-color: #333; }
    .gp-sidebar:not([data-theme="light"]) .gp-ts { background: #0F6E56; color: #9FE1CB; }
    .gp-sidebar:not([data-theme="light"]) .gp-pin-ts { background: #0F6E56; color: #9FE1CB; }
    .gp-sidebar:not([data-theme="light"]) .gp-btn { border-color: #333; color: #aaa; }
    .gp-sidebar:not([data-theme="light"]) .gp-btn:hover { border-color: #5DCAA5; color: #5DCAA5; }
    .gp-sidebar:not([data-theme="light"]) .gp-btn.primary { border-color: #0F6E56; color: #9FE1CB; background: #1a3320; }
    .gp-sidebar:not([data-theme="light"]) .gp-textarea { background: #2a2a2a; border-color: #5DCAA5; color: #e8e6e0; }
    .gp-sidebar:not([data-theme="light"]) .gp-textarea:focus { box-shadow: 0 0 0 2px #1a3320; }
    .gp-sidebar:not([data-theme="light"]) .gp-divider { background: #2e2e2e; }
    .gp-sidebar:not([data-theme="light"]) .gp-note-text, .gp-sidebar:not([data-theme="light"]) .gp-title { color: #e8e6e0; }
    .gp-sidebar:not([data-theme="light"]) .gp-sum-text { color: #aaa; }
    .gp-sidebar:not([data-theme="light"]) .gp-badge.green { background: #1a3320; color: #5DCAA5; }
    .gp-sidebar:not([data-theme="light"]) .gp-badge.paused { background: #2a1f00; color: #BA7517; }
    .gp-sidebar:not([data-theme="light"]) .gp-spinner { border-color: #1a3320; border-top-color: #5DCAA5; }
    .gp-sidebar:not([data-theme="light"]) .gp-action { color: #555 !important; }
    .gp-sidebar:not([data-theme="light"]) .gp-action:hover { color: #5DCAA5 !important; background: #1a3320 !important; }
    .gp-sidebar:not([data-theme="light"]) .gp-logo rect,
    .gp-sidebar:not([data-theme="light"]) .gp-logo circle,
    .gp-sidebar:not([data-theme="light"]) .gp-logo line {
      stroke: #5DCAA5 !important;
      fill: none !important;
    }
    .gp-sidebar:not([data-theme="light"]) .gp-logo rect:first-child { fill: rgba(95,210,165,0.15) !important; stroke: #5DCAA5 !important; }
    .gp-sidebar:not([data-theme="light"]) .gp-logo circle { fill: #5DCAA5 !important; }
  }

  .gp-pill:global([data-theme="dark"]) { background: #0F6E56; }
  .gp-pill:global([data-theme="dark"]):hover { background: #085041; }
  .gp-sidebar:global([data-theme="dark"]) { background: #1f1f1f; border-color: #2e2e2e; color: #e8e6e0; }
  .gp-sidebar:global([data-theme="dark"]) .gp-header, .gp-sidebar:global([data-theme="dark"]) .gp-meta, .gp-sidebar:global([data-theme="dark"]) .gp-footer { border-color: #2e2e2e; }
  .gp-sidebar:global([data-theme="dark"]) .gp-note-row { border-color: #2e2e2e; }
  .gp-sidebar:global([data-theme="dark"]) .gp-note-row:hover { background: #252525 !important; }
  .gp-sidebar:global([data-theme="dark"]) .gp-bar { background: #2a2a2a; }
  .gp-sidebar:global([data-theme="dark"]) .gp-pin-row { background: #2a2a2a; border-color: #333; }
  .gp-sidebar:global([data-theme="dark"]) .gp-ts { background: #0F6E56; color: #9FE1CB; }
  .gp-sidebar:global([data-theme="dark"]) .gp-pin-ts { background: #0F6E56; color: #9FE1CB; }
  .gp-sidebar:global([data-theme="dark"]) .gp-btn { border-color: #333; color: #aaa; }
  .gp-sidebar:global([data-theme="dark"]) .gp-btn:hover { border-color: #5DCAA5; color: #5DCAA5; }
  .gp-sidebar:global([data-theme="dark"]) .gp-btn.primary { border-color: #0F6E56; color: #9FE1CB; background: #1a3320; }
  .gp-sidebar:global([data-theme="dark"]) .gp-textarea { background: #2a2a2a; border-color: #5DCAA5; color: #e8e6e0; }
  .gp-sidebar:global([data-theme="dark"]) .gp-textarea:focus { box-shadow: 0 0 0 2px #1a3320; }
  .gp-sidebar:global([data-theme="dark"]) .gp-divider { background: #2e2e2e; }
  .gp-sidebar:global([data-theme="dark"]) .gp-note-text, .gp-sidebar:global([data-theme="dark"]) .gp-title { color: #e8e6e0; }
  .gp-sidebar:global([data-theme="dark"]) .gp-sum-text { color: #aaa; }
  .gp-sidebar:global([data-theme="dark"]) .gp-badge.green { background: #1a3320; color: #5DCAA5; }
  .gp-sidebar:global([data-theme="dark"]) .gp-badge.paused { background: #2a1f00; color: #BA7517; }
  .gp-sidebar:global([data-theme="dark"]) .gp-spinner { border-color: #1a3320; border-top-color: #5DCAA5; }
  .gp-sidebar:global([data-theme="dark"]) .gp-action { color: #555 !important; }
  .gp-sidebar:global([data-theme="dark"]) .gp-action:hover { color: #5DCAA5 !important; background: #1a3320 !important; }
  .gp-sidebar:global([data-theme="dark"]) .gp-logo rect,
  .gp-sidebar:global([data-theme="dark"]) .gp-logo circle,
  .gp-sidebar:global([data-theme="dark"]) .gp-logo line {
    stroke: #5DCAA5 !important;
    fill: none !important;
  }
  .gp-sidebar:global([data-theme="dark"]) .gp-logo rect:first-child { fill: rgba(95,210,165,0.15) !important; stroke: #5DCAA5 !important; }
  .gp-sidebar:global([data-theme="dark"]) .gp-logo circle { fill: #5DCAA5 !important; }
</style>