<script lang="ts">
  import { onMount } from 'svelte'
  import type { UserSettings } from '$types/index'

  let settings: UserSettings = {
    theme:              'auto',
    pinShortcut:        'n',
    summariseThreshold: 7,
    allowedDomains:     [],
  }
  let saved  = false
  let saving = false
  onMount(async () => {
    const res = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })
    if (res.ok) settings = res.data
  })

  $: domainsText = settings.allowedDomains.join('\n')

  async function save() {
    saving = true
    settings.allowedDomains = domainsText.split('\n').map(d => d.trim()).filter(Boolean)
    await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: { settings } })
    saving = false
    saved  = true
    setTimeout(() => saved = false, 2000)
  }
</script>

<main>
  <header>
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <rect x="2" y="9" width="28" height="17" rx="3" fill="#97C459" fill-opacity="0.2"/>
      <rect x="2" y="9" width="28" height="17" rx="3" stroke="#3B6D11" stroke-width="1.5"/>
      <circle cx="14" cy="17.5" r="2" fill="#3B6D11"/>
      <line x1="14" y1="9"  x2="14" y2="26" stroke="#3B6D11" stroke-width="1" stroke-dasharray="2 2" stroke-opacity="0.5"/>
      <line x1="14" y1="2"  x2="14" y2="9"  stroke="#3B6D11" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="10.5" y1="4.5" x2="14" y2="3" stroke="#3B6D11" stroke-width="1" stroke-linecap="round"/>
      <line x1="17.5" y1="4.5" x2="14" y2="3" stroke="#3B6D11" stroke-width="1" stroke-linecap="round"/>
    </svg>
    <h1>Grovepin settings</h1>
  </header>

  <form on:submit|preventDefault={save}>

    <section>
      <h2>AI summarise</h2>
      <p class="desc">Grovepin includes AI summarisation powered by Claude — no API key needed. You get 10 free summarises per month, resetting on the 1st of each month.</p>

    </section>

    <section>
      <h2>Keyboard shortcuts</h2>
      <label>
        <span>Pin moment key</span>
        <div class="row-inline">
          <input
            type="text"
            maxlength="1"
            bind:value={settings.pinShortcut}
            style="width:48px;text-align:center;text-transform:uppercase;"
            on:input={e => settings.pinShortcut = (e.currentTarget as HTMLInputElement).value.toLowerCase()}
          />
          <span class="hint">Single key, fires when sidebar is active on a video page</span>
        </div>
      </label>
      <p class="hint" style="margin-top:4px;">
        Open popup: <kbd>Cmd/Ctrl + Shift + Y</kbd> · Toggle sidebar: <kbd>Cmd/Ctrl + Shift + H</kbd><br>
        Change in <a href="chrome://extensions/shortcuts" target="_blank">chrome://extensions/shortcuts</a>
      </p>
    </section>

    <section>
      <h2>Appearance</h2>
      <label>
        <span>Theme</span>
        <select bind:value={settings.theme}>
          <option value="auto">Auto (follow system)</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </section>

    <section>
      <h2>Enabled sites</h2>
      <p class="desc">Grovepin activates on these domains. Add any site with an HTML5 video player.</p>
      <textarea
        bind:value={domainsText}
        rows="6"
        placeholder="example.com"
        style="width:100%;font-size:12px;padding:7px 10px;border:0.5px solid #ddd;
               border-radius:6px;font-family:monospace;resize:vertical;"
      ></textarea>
      <p class="hint">One domain per line. Subdomains are matched automatically.</p>
    </section>

    <div class="actions">
      <button type="submit" class="save-btn" disabled={saving}>
        {#if saving}Saving…{:else if saved}Saved ✓{:else}Save settings{/if}
      </button>
    </div>

  </form>
</main>

<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  main{max-width:520px;margin:40px auto;padding:0 20px;font-family:system-ui,sans-serif;color:#1a1a18;}
  header{display:flex;align-items:center;gap:10px;margin-bottom:28px;}
  h1{font-size:18px;font-weight:500;color:#1a1a18;}
  h2{font-size:13px;font-weight:500;color:#1a1a18;margin-bottom:12px;}
  section{margin-bottom:28px;padding-bottom:28px;border-bottom:0.5px solid #e8e8e6;}
  section:last-of-type{border-bottom:none;}
  .desc{font-size:12px;color:#888;margin-bottom:14px;line-height:1.55;}
  label{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;}
  label span{font-size:12px;font-weight:500;color:#3d3d3a;}
  .hint{font-size:11px;color:#aaa;}
  .hint a{color:#3B6D11;}
  input[type="text"],select{
    font-size:12px;padding:7px 10px;border:0.5px solid #ddd;border-radius:6px;
    background:#fff;color:#1a1a18;font-family:inherit;outline:none;
  }
  input:focus,select:focus{border-color:#3B6D11;}
  
  
  
  .row-inline{display:flex;align-items:center;gap:10px;}
  kbd{background:#f0f0ee;padding:1px 6px;border-radius:3px;border:0.5px solid #ddd;font-size:11px;font-family:inherit;}
  .actions{margin-top:8px;}
  .save-btn{font-size:12px;padding:8px 20px;border:none;border-radius:6px;background:#3B6D11;color:#EAF3DE;cursor:pointer;font-weight:500;}
  .save-btn:disabled{opacity:0.6;cursor:not-allowed;}
  .save-btn:not(:disabled):hover{background:#27500A;}
</style>