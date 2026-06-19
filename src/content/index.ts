import { hasVideo, detectPlatform, getVideoTitle, generateId } from '$lib/video'
import { getSettings } from '$lib/storage'
import type { Session } from '$types/index'

// Only run on pages that have a <video> element
if (!hasVideo()) {
  // Watch for late-loaded video (SPAs, dynamic content)
  const observer = new MutationObserver(() => {
    if (hasVideo()) {
      observer.disconnect()
      init()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
} else {
  init()
}

async function init() {
  // Don't double-mount
  if (document.getElementById('grovepin-host')) return

  const settings = await getSettings()

  // ─── Create shadow host ───────────────────────────────────────────────────
  const host = document.createElement('div')
  host.id = 'grovepin-host'
  Object.assign(host.style, {
    position:   'fixed',
    top:        '0',
    right:      '0',
    width:      '220px',
    height:     '100vh',
    zIndex:     '2147483647',
    pointerEvents: 'none', // host is transparent; shadow root handles events
  })
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })

  // ─── Inject Tailwind/sidebar CSS into shadow root ─────────────────────────
  const styleEl = document.createElement('link')
  styleEl.rel  = 'stylesheet'
  styleEl.href = chrome.runtime.getURL('src/content/sidebar.css')
  shadow.appendChild(styleEl)

  // ─── Mount Svelte sidebar ─────────────────────────────────────────────────
  const mountPoint = document.createElement('div')
  mountPoint.style.pointerEvents = 'auto'
  shadow.appendChild(mountPoint)

  // Session identity for this page
  const session: Session = {
    id:                 generateId(),
    videoUrl:           location.href,
    videoTitle:         getVideoTitle(),
    platform:           detectPlatform(location.href),
    pins:               [],
    createdAt:          Date.now(),
    updatedAt:          Date.now(),
    lastSummarisedAt:   null,
  }

  // Lazy import to keep content script bundle lean
  const { default: Sidebar } = await import('./sidebar/Sidebar.svelte')
  new Sidebar({ target: mountPoint, props: { session, settings } })

  // ─── Global keyboard shortcut — N to pin ─────────────────────────────────
  document.addEventListener('keydown', (e) => {
    // Only fire if focused element is not an input/textarea
    const tag = (document.activeElement?.tagName ?? '').toLowerCase()
    if (['input', 'textarea', 'select', '[contenteditable]'].includes(tag)) return
    if (e.key.toLowerCase() === settings.pinShortcut) {
      e.preventDefault()
      mountPoint.dispatchEvent(new CustomEvent('grovepin:pin', { bubbles: true }))
    }
  })
}
