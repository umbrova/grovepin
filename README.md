# Grovepin

> Pin moments in any video, on any platform.

Grovepin is a Chrome extension that lets you drop timestamped notes on videos while watching — on YouTube, Vimeo, Coursera, Udemy, Loom, LinkedIn Learning, and more. No more pausing to open Notion. Press `N`, type your thought, resume.

![Grovepin sidebar showing pinned notes on a video](https://grovepin.app/og.png)

## Features

- **Pin moments** — press `N` on any video page to capture a timestamped note. Video pauses while you type, resumes on save.
- **Works everywhere** — YouTube, Vimeo, Coursera, Udemy, Loom, LinkedIn Learning, Wistia, and any HTML5 video player
- **Jump back** — click any timestamp to seek the video to that exact moment
- **AI summary** — after 7+ pins, summarise your notes into key points and revisit items with one click (10 free summaries/month, no API key needed)
- **Export** — download your notes as a clean Markdown file
- **Session history** — popup shows all past sessions across platforms, searchable
- **Dark mode** — follows your system preference automatically
- **Collapse to pill** — hide the sidebar to a slim icon when you need full screen

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Pin current moment | `N` (while on a video page) |
| Toggle sidebar | `Ctrl/Cmd + Shift + H` |
| Open popup | `Ctrl/Cmd + Shift + Y` |

Change shortcuts at `chrome://extensions/shortcuts`

## Install

### From Chrome Web Store
Coming soon — [grovepin.app](https://grovepin.app)

### Load unpacked (dev)
```bash
git clone https://github.com/silvonix/grovepin.git
cd grovepin
npm install
npm run build
```
Then open `chrome://extensions` → Enable Developer mode → Load unpacked → select `dist/`

## Tech stack

- **Vite** + `vite-plugin-web-extension` — MV3 multi-entry build
- **Svelte 5** + TypeScript — UI components
- **Tailwind CSS** + shadcn-svelte — styling
- **Manifest V3** — Chrome extension API
- **Cloudflare Workers** (via [grovepin-worker](https://github.com/silvonix/grovepin-worker)) — AI proxy with rate limiting

## Project structure

```
src/
  background/     service worker — storage + message routing
  content/        injected into video pages
    sidebar/      Svelte sidebar component
  popup/          toolbar popup — session history
  options/        settings page
  lib/
    ai.ts         Anthropic API call via worker proxy
    storage.ts    typed chrome.storage wrappers
    video.ts      platform detection, video element utils
    export.ts     Markdown export
  types/          shared TypeScript interfaces
public/
  icons/          extension icons
manifest.json
```

## Development

```bash
npm run dev     # watch mode — auto-rebuilds on save
npm run build   # production build → dist/
```

After any change, click the reload icon on the Grovepin card in `chrome://extensions`.

## Privacy

All notes are stored locally in `chrome.storage.local` on your device. Nothing is sent to any server except the AI summarise call, which sends only your note text (not video URLs or personal data) to our Cloudflare Worker proxy. No account required.

## License

MIT — see [LICENSE](LICENSE)

## Contact

Feedback → [hello@sylvoralabs.com](mailto:hello@sylvoralabs.com?subject=Grovepin%20Feedback)  
Made by [Sylvora Labs](https://sylvoralabs.com)