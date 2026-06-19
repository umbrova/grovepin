import { z } from 'zod'
import type { Pin, SummaryResult } from '$types/index'

const SummarySchema = z.object({
  overview:  z.string(),
  keyPoints: z.array(z.string()),
  revisit:   z.array(z.object({
    timestamp: z.number(),
    note:      z.string(),
  })),
})

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export async function summarisePins(
  pins: Pin[],
  videoTitle: string,
  apiKey: string,
): Promise<SummaryResult> {
  const pinList = pins
    .map(p => `[${formatTimestamp(p.timestamp)}] ${p.text}`)
    .join('\n')

  const prompt = `You are a study assistant. The user watched: "${videoTitle}"

Their timestamped notes:
${pinList}

Return ONLY a valid JSON object with this exact shape — no preamble, no markdown fences:
{
  "overview": "2-3 sentence summary of what was covered",
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "revisit": [
    { "timestamp": 125, "note": "brief description of what to revisit" }
  ]
}

Rules:
- overview: 2-3 sentences max
- keyPoints: 3-5 items max, each under 15 words
- revisit: only include pins the user explicitly flagged for review (words like "revisit", "check", "look up", "unclear") — can be empty array
- timestamp values must be numbers in seconds, taken directly from the notes
- Return raw JSON only`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':         'application/json',
      'x-api-key':            apiKey,
      'anthropic-version':    '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages:   [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message ?? 'API error')
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }> }
  const raw = data.content.find(b => b.type === 'text')?.text ?? ''

  const cleaned = raw.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(cleaned)
  return SummarySchema.parse(parsed)
}
