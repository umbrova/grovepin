import { z } from 'zod'
import type { Pin, SummaryResult } from '$types/index'

const WORKER_URL = 'https://grovepin-worker.silvonix.workers.dev'

const SummarySchema = z.object({
  overview:  z.string(),
  keyPoints: z.array(z.string()),
  revisit:   z.array(z.object({
    timestamp: z.number(),
    note:      z.string(),
  })),
})

function getInstallId(): string {
  // Use extension ID as stable install identifier
  return chrome.runtime.id
}

export async function summarisePins(
  pins:       Pin[],
  videoTitle: string,
  _apiKey:    string,  // kept for signature compat, unused — key lives in worker
): Promise<SummaryResult> {
  const response = await fetch(`${WORKER_URL}/summarise`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Install-ID': getInstallId(),
    },
    body: JSON.stringify({
      pins: pins.map(p => ({ timestamp: p.timestamp, text: p.text })),
      videoTitle,
    }),
  })

  const data = await response.json() as {
    ok:    boolean
    data?: SummaryResult
    error?: string
    rateLimitInfo?: { used: number; limit: number; remaining: number }
  }

  if (!data.ok) {
    throw new Error(data.error ?? 'Summarise failed')
  }

  return SummarySchema.parse(data.data)
}

export async function getRateLimitInfo(): Promise<{ used: number; limit: number; remaining: number } | null> {
  try {
    const res  = await fetch(`${WORKER_URL}/rate-limit/${chrome.runtime.id}`)
    const data = await res.json() as { ok: boolean; used: number; limit: number; remaining: number }
    return data.ok ? data : null
  } catch {
    return null
  }
}