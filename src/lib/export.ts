import type { Session } from '$types/index'
import { PLATFORM_LABEL } from './video'
import { formatTimestamp } from './video'

export function sessionToMarkdown(session: Session): string {
  const date = new Date(session.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const platform = PLATFORM_LABEL[session.platform]

  const pins = [...session.pins]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(p => `- **${formatTimestamp(p.timestamp)}** — ${p.text}`)
    .join('\n')

  return `# ${session.videoTitle}

**Platform:** ${platform}
**Date:** ${date}
**Video:** ${session.videoUrl}

## Pins

${pins}
`.trimEnd() + '\n'
}

export function downloadMarkdown(session: Session): void {
  const content  = sessionToMarkdown(session)
  const filename = session.videoTitle
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 60) + '.md'

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
