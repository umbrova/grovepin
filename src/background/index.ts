import type { Message, MessageResponse, Session } from '$types/index'
import {
  getAllSessions, getSession, saveSession,
  getSettings, saveSettings, generateId,
} from '$lib/storage'
import { summarisePins } from '$lib/ai'

// ─── Message router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (msg: Message, _sender, sendResponse: (r: MessageResponse) => void) => {
    handle(msg).then(sendResponse).catch(err => {
      sendResponse({ ok: false, error: String(err) })
    })
    return true // keep channel open for async response
  }
)

async function handle(msg: Message): Promise<MessageResponse> {
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
      const [session, settings] = await Promise.all([
        getSession(sessionId),
        getSettings(),
      ])
      if (!session)       return { ok: false, error: 'Session not found' }
      if (!settings.apiKey) return { ok: false, error: 'No API key set — add one in Settings' }
      if (session.pins.length < settings.summariseThreshold) {
        return { ok: false, error: `Need at least ${settings.summariseThreshold} pins to summarise` }
      }
      const summary = await summarisePins(session.pins, session.videoTitle, settings.apiKey)
      // persist lastSummarisedAt
      session.lastSummarisedAt = Date.now()
      await saveSession(session)
      return { ok: true, data: summary }
    }

    case 'GET_SETTINGS': {
      const settings = await getSettings()
      return { ok: true, data: settings }
    }

    case 'SAVE_SETTINGS': {
      await saveSettings(msg.payload.settings)
      return { ok: true, data: null }
    }

    default:
      return { ok: false, error: 'Unknown message type' }
  }
}

// ─── Install handler ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html') })
  }
})
