import { hasVideo, detectPlatform, getVideoTitle } from '$lib/video'
import { getSettings, generateId } from '$lib/storage'
import { mount } from 'svelte'
import Sidebar from './sidebar/Sidebar.svelte'
import type { Session } from '$types/index'

if (!hasVideo()) {
  const observer = new MutationObserver(() => {
    if (hasVideo() && !document.getElementById('grovepin-host')) {
      observer.disconnect()
      init()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
} else {
  init()
}

async function init() {
  if (document.getElementById('grovepin-host')) return

  const settings = await getSettings()

  const res      = await chrome.runtime.sendMessage({ type: 'GET_ALL_SESSIONS' })
  const sessions = res.ok ? Object.values(res.data) as Session[] : []
  const existing = sessions.find((s: Session) => s.videoUrl === location.href)


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


  const session: Session = {
    id:               generateId(),
    videoUrl:         location.href,
    videoTitle:       getVideoTitle(),
    platform:         detectPlatform(location.href),
    pins:             [],
    createdAt:        Date.now(),
    updatedAt:        Date.now(),
    lastSummarisedAt: null,
  }

  requestAnimationFrame(() => {
    mount(Sidebar, {
      target: host,
      props:  { session, settings },
    })
  })

  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement?.tagName ?? '').toLowerCase()
    if (['input', 'textarea', 'select'].includes(tag)) return
    if (e.key.toLowerCase() === settings.pinShortcut) {
      e.preventDefault()
      host.dispatchEvent(new CustomEvent('grovepin:pin', { bubbles: true }))
    }
  })

  chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TOGGLE_SIDEBAR') {
    host.dispatchEvent(new CustomEvent('grovepin:toggle', { bubbles: true }))
  }
})
}