// ─── Core domain types ───────────────────────────────────────────────────────

export interface Pin {
  id: string
  timestamp: number      // seconds — from video.currentTime
  text: string
  createdAt: number      // Date.now()
  updatedAt: number
}

export interface Session {
  id: string
  videoUrl: string
  videoTitle: string
  platform: Platform
  pins: Pin[]
  createdAt: number
  updatedAt: number
  lastSummarisedAt: number | null
}

export type Platform =
  | 'coursera'
  | 'udemy'
  | 'vimeo'
  | 'loom'
  | 'youtube'
  | 'linkedin'
  | 'wistia'
  | 'other'

// ─── Storage schema ───────────────────────────────────────────────────────────

export interface StorageSchema {
  sessions: Record<string, Session>   // keyed by session.id
  settings: UserSettings
}

export interface UserSettings {
  theme: 'auto' | 'light' | 'dark'
  pinShortcut: string                 // default 'n'
  summariseThreshold: number          // default 7
}

// ─── Messages between content ↔ background ───────────────────────────────────

export type Message =
  | { type: 'GET_SESSION';    payload: { sessionId: string } }
  | { type: 'SAVE_PIN';       payload: { sessionId: string; pin: Pin } }
  | { type: 'UPDATE_PIN';     payload: { sessionId: string; pin: Pin } }
  | { type: 'DELETE_PIN';     payload: { sessionId: string; pinId: string } }
  | { type: 'SAVE_SESSION';   payload: { session: Session } }
  | { type: 'GET_ALL_SESSIONS' }
  | { type: 'SUMMARISE';      payload: { sessionId: string } }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS';  payload: { settings: Partial<UserSettings> } }

export type MessageResponse<T = unknown> =
  | { ok: true;  data: T }
  | { ok: false; error: string }

// ─── AI response shape (validated with Zod in lib/ai.ts) ─────────────────────

export interface SummaryResult {
  overview:   string
  keyPoints:  string[]
  revisit:    Array<{ timestamp: number; note: string }>
}
