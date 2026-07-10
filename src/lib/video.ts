import type { Platform } from '$types/index'

export function detectPlatform(url: string): Platform {
  if (url.includes('coursera.org'))    return 'coursera'
  if (url.includes('udemy.com'))       return 'udemy'
  if (url.includes('vimeo.com'))       return 'vimeo'
  if (url.includes('loom.com'))        return 'loom'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('linkedin.com'))    return 'linkedin'
  if (url.includes('wistia.com') || url.includes('wistia.net')) return 'wistia'
  return 'other'
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  coursera:  'Coursera',
  udemy:     'Udemy',
  vimeo:     'Vimeo',
  loom:      'Loom',
  youtube:   'YouTube',
  linkedin:  'LinkedIn',
  wistia:    'Wistia',
  other:     'Video',
}

// Colour used for the platform dot in popup
export const PLATFORM_COLOR: Record<Platform, string> = {
  coursera:  '#185FA5',
  udemy:     '#854F0B',
  vimeo:     '#1D9E75',
  loom:      '#534AB7',
  youtube:   '#D85A30',
  linkedin:  '#378ADD',
  wistia:    '#D4537E',
  other:     '#888780',
}

export function getVideoElement(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll('video'))
  if (videos.length === 0) return null
  // Filter out thumbnails and preview clips — must be at least 200x120px
  // This prevents Google search result thumbnails from triggering the sidebar
  const candidates = videos.filter(v => {
    const rect = v.getBoundingClientRect()
    return rect.width >= 200 && rect.height >= 120
  })
  if (candidates.length === 0) return null
  // Pick the largest visible one
  return candidates.reduce((best, v) =>
    v.offsetWidth * v.offsetHeight > best.offsetWidth * best.offsetHeight ? v : best
  )
}

export function getCurrentTime(): number {
  return getVideoElement()?.currentTime ?? 0
}

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function pauseVideo(): void {
  getVideoElement()?.pause()
}

export function resumeVideo(): void {
  getVideoElement()?.play()
}

export function seekTo(seconds: number): void {
  const v = getVideoElement()
  if (v) v.currentTime = seconds
}

export function getVideoDuration(): number {
  return getVideoElement()?.duration ?? 0
}

export function getVideoProgress(): number {
  const v = getVideoElement()
  if (!v || !v.duration) return 0
  return v.currentTime / v.duration
}

export function getVideoTitle(): string {
  // Try <title>, then og:title, then first h1
  const og = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')
  if (og?.content) return og.content
  if (document.title) return document.title.split('|')[0].split('-')[0].trim()
  return document.querySelector('h1')?.textContent?.trim() ?? 'Untitled video'
}

export function hasVideo(): boolean {
  return getVideoElement() !== null
}

// Platforms we explicitly support — sidebar only shows on these
const SUPPORTED_PLATFORMS: Platform[] = [
  'coursera', 'udemy', 'vimeo', 'loom', 'youtube', 'linkedin', 'wistia'
]

export function isSupportedVideoPage(): boolean {
  const platform = detectPlatform(location.href)

  // Always show on known platforms
  if (SUPPORTED_PLATFORMS.includes(platform)) return true

  // For unknown platforms — check if this looks like intentional video content
  const video = getVideoElement()
  if (!video) return false

  // Must have meaningful duration (> 60s rules out most hero/ad loops)
  const duration = video.duration
  if (!isNaN(duration) && isFinite(duration) && duration < 60) return false

  // Must not be autoplay muted background video (decorative)
  // If autoplay AND muted AND no controls — it's almost certainly decorative
  const isDecorativeBg = video.autoplay && video.muted && !video.controls
  if (isDecorativeBg) return false

  return true
}