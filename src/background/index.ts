import type { Message, MessageResponse, Session } from '$types/index'
import {
  getAllSessions, getSession, saveSession, deleteSession,
  getSettings, saveSettings, generateId,
} from '$lib/storage'
import { summarisePins } from '$lib/ai'

// ─── Message router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(
  (msg: Message & { type: string }, _sender, sendResponse: (r: MessageResponse) => void) => {
    handle(msg).then(sendResponse).catch(err => {
      sendResponse({ ok: false, error: String(err) })
    })
    return true
  }
)

async function handle(msg: Message & { type: string }): Promise<MessageResponse> {
  switch (msg.type) {

    case 'GET_ALL_SESSIONS': {
      const sessions = await getAllSessions()
      return { ok: true, data: sessions }
    }

    case 'GET_SESSION': {
      const session = await getSession(msg.payload.sessionId)
      return { ok: true, data: session }
    }

    case 'SAVE_SESSION': {
      await saveSession(msg.payload.session)
      return { ok: true, data: null }
    }

    case 'SAVE_PIN': {
      const { sessionId, pin } = msg.payload
      const session = await getSession(sessionId)
      if (!session) return { ok: false, error: 'Session not found' }
      session.pins.push(pin)
      session.updatedAt = Date.now()
      await saveSession(session)
      return { ok: true, data: pin }
    }

    case 'UPDATE_PIN': {
      const { sessionId, pin } = msg.payload
      const session = await getSession(sessionId)
      if (!session) return { ok: false, error: 'Session not found' }
      const idx = session.pins.findIndex(p => p.id === pin.id)
      if (idx === -1) return { ok: false, error: 'Pin not found' }
      session.pins[idx] = pin
      session.updatedAt = Date.now()
      await saveSession(session)
      return { ok: true, data: pin }
    }

    case 'DELETE_PIN': {
      const { sessionId, pinId } = msg.payload
      const session = await getSession(sessionId)
      if (!session) return { ok: false, error: 'Session not found' }
      session.pins = session.pins.filter(p => p.id !== pinId)
      session.updatedAt = Date.now()
      await saveSession(session)
      return { ok: true, data: null }
    }

    case 'SUMMARISE': {
      const { sessionId } = msg.payload
      const session = await getSession(sessionId)
      if (!session) return { ok: false, error: 'Session not found' }

      const SUMMARISE_THRESHOLD = 7
      if (session.pins.length < SUMMARISE_THRESHOLD) {
        return { ok: false, error: `Need at least ${SUMMARISE_THRESHOLD} pins to summarise` }
      }

      // FIX: if already summarised, return cached summary signal
      // (summary content isn't stored — just re-call the API)
      const summary = await summarisePins(session.pins, session.videoTitle)
      session.lastSummarisedAt = Date.now()
      await saveSession(session)
      return { ok: true, data: { summary, lastSummarisedAt: session.lastSummarisedAt } }
    }

    case 'PURGE_EMPTY_SESSIONS': {
      const sessions = await getAllSessions()
      for (const [id, session] of Object.entries(sessions)) {
        if (session.pins.length === 0) await deleteSession(id)
      }
      return { ok: true, data: null }
    }

    case 'DELETE_SESSION': {
      const { sessionId } = msg.payload
      await deleteSession(sessionId)
      return { ok: true, data: null }
    }

    case 'GET_SETTINGS': {
      const settings = await getSettings()
      return { ok: true, data: settings }
    }

    case 'SAVE_SETTINGS': {
      await saveSettings(msg.payload.settings)
      return { ok: true, data: null }
    }

    // FIX: open options page from background (works from content script context)
    case 'OPEN_OPTIONS_PAGE': {
      chrome.runtime.openOptionsPage()
      return { ok: true, data: null }
    }

    // FIX: toggle sidebar command relay
    case 'RELAY_TOGGLE': {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_SIDEBAR' })
      }
      return { ok: true, data: null }
    }

    default:
      return { ok: false, error: 'Unknown message type' }
  }
}

// ─── Toolbar icon click — inject sidebar if not present ──────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return
  // Try sending a toggle message first
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' })
  } catch {
    // Content script not running — inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files:  ['src/content/index.js'],
      })
    } catch {
      // Content script could not be injected (e.g. restricted page)
    }
  }
})

// ─── Keyboard command — toggle sidebar ───────────────────────────────────────
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-sidebar') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_SIDEBAR' })
      }
    })
  }
})

// ─── Install handler ──────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html') })
  }
})

// ─── Startup: clean up 0-pin sessions ────────────────────────────────────────
chrome.runtime.onStartup.addListener(async () => {
  const sessions = await getAllSessions()
  for (const [id, session] of Object.entries(sessions)) {
    if (session.pins.length === 0) {
      await deleteSession(id)
    }
  }
})