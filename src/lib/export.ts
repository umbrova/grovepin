import type { Session, SummaryResult } from '$types/index'
import { PLATFORM_LABEL } from './video'
import { formatTimestamp } from './video'

export function sessionToMarkdown(session: Session, summary?: SummaryResult | null): string {
  const date = new Date(session.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const platform = PLATFORM_LABEL[session.platform]

  const pins = [...session.pins]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(p => `- **${formatTimestamp(p.timestamp)}** — ${p.text}`)
    .join('\n')

  let md = `# ${session.videoTitle}

**Platform:** ${platform}
**Date:** ${date}
**Video:** ${session.videoUrl}

## Pins

${pins}
`.trimEnd() + '\n'

  if (summary) {
    md += '\n---\n\n## AI Summary\n\n'
    md += `### Overview\n\n${summary.overview}\n\n`
    md += '### Key Points\n\n'
    summary.keyPoints.forEach(p => { md += `- ${p}\n` })
    if (summary.revisit?.length) {
      md += '\n### Revisit\n\n'
      summary.revisit.forEach(r => {
        md += `- ${formatTimestamp(r.timestamp)} — ${r.note}\n`
      })
    }
  }

  return md
}

export function downloadMarkdown(session: Session, summary?: SummaryResult | null): void {
  const content  = sessionToMarkdown(session, summary)
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
