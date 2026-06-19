import type { Session, UserSettings, StorageSchema } from '$types/index'

const DEFAULT_SETTINGS: UserSettings = {
  apiKey:               null,
  theme:                'auto',
  pinShortcut:          'n',
  summariseThreshold:   7,
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function getAllSessions(): Promise<Record<string, Session>> {
  const result = await chrome.storage.local.get('sessions')
  return (result.sessions as Record<string, Session>) ?? {}
}

export async function getSession(id: string): Promise<Session | null> {
  const sessions = await getAllSessions()
  return sessions[id] ?? null
}

export async function saveSession(session: Session): Promise<void> {
  const sessions = await getAllSessions()
  sessions[session.id] = session
  await chrome.storage.local.set({ sessions })
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await getAllSessions()
  delete sessions[id]
  await chrome.storage.local.set({ sessions })
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<UserSettings> {
  const result = await chrome.storage.local.get('settings')
  return { ...DEFAULT_SETTINGS, ...(result.settings as Partial<UserSettings> ?? {}) }
}

export async function saveSettings(patch: Partial<UserSettings>): Promise<void> {
  const current = await getSettings()
  await chrome.storage.local.set({ settings: { ...current, ...patch } })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
