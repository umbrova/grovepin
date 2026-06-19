import { hasVideo, detectPlatform, getVideoTitle } from '$lib/video'
import { getSettings, generateId } from '$lib/storage'
import { mount } from 'svelte'
import Sidebar from './sidebar/Sidebar.svelte'
import type { Session } from '$types/index'

let currentUrl     = location.href
let sidebarMounted = false

// ─── SPA URL change watcher ───────────────────────────────────────────────────
const urlObserver = new MutationObserver(() => {
  if (location.href !== currentUrl) {
    currentUrl = location.href
    const old = document.getElementById('grovepin-host')
    if (old) old.remove()
    sidebarMounted = false
    // Small wait for video element to appear, no title polling needed
    setTimeout(() => tryInit(), 800)
  }
})
urlObserver.observe(document.body, { childList: true, subtree: true })

// ─── Initial load ─────────────────────────────────────────────────────────────
if (hasVideo()) {
  init()
} else {
  const videoObserver = new MutationObserver(() => {
    if (hasVideo() && !sidebarMounted) {
      videoObserver.disconnect()
      init()
    }
  })
  videoObserver.observe(document.body, { childList: true, subtree: true })
}

function tryInit() {
  if (hasVideo()) {
    init()
  } else {
    const observer = new MutationObserver(() => {
      if (hasVideo() && !sidebarMounted) {
        observer.disconnect()
        init()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  }
}

async function init() {
  if (sidebarMounted || document.getElementById('grovepin-host')) return
  sidebarMounted = true

  const settings = await getSettings()
  const freshUrl  = location.href

  // Look up existing session for this URL
  const res      = await chrome.runtime.sendMessage({ type: 'GET_ALL_SESSIONS' })
  const all      = res.ok ? Object.values(res.data) as Session[] : []
  const existing = all.find((s: Session) => s.videoUrl === freshUrl)

  // FIX: title is intentionally left empty on new sessions
  // It will be read and saved on first pin save, when page is fully loaded
  const session: Session = existing ?? {
    id:               generateId(),
    videoUrl:         freshUrl,
    videoTitle:       '',   // filled on first pin save
    platform:         detectPlatform(freshUrl),
    pins:             [],
    createdAt:        Date.now(),
    updatedAt:        Date.now(),
    lastSummarisedAt: null,
  }

  const host = document.createElement('div')
  host.id = 'grovepin-host'
  Object.assign(host.style, {
    position:      'fixed',
    top:           '0',
    right:         '0',
    width:         '220px',
    height:        '100vh',
    zIndex:        '2147483647',
    pointerEvents: 'auto',
  })
  document.body.appendChild(host)

  requestAnimationFrame(() => {
    mount(Sidebar, { target: host, props: { session, settings } })
  })

  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement?.tagName ?? '').toLowerCase()
    if (['input', 'textarea', 'select'].includes(tag)) return
    if (e.key.toLowerCase() === (settings.pinShortcut ?? 'n')) {
      e.preventDefault()
      host.dispatchEvent(new CustomEvent('grovepin:pin', { bubbles: true }))
    }
  })

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TOGGLE_SIDEBAR') {
      host.dispatchEvent(new CustomEvent('grovepin:toggle', { bubbles: true }))
    }
    if (msg.type === 'OPEN_OPTIONS') {
      chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' })
    }
  })
}