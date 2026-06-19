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
  // Prefer the largest visible video on the page
  const videos = Array.from(document.querySelectorAll('video'))
  if (videos.length === 0) return null
  return videos.reduce((best, v) =>
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
