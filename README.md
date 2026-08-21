# Grovepin

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/jhekobecppdnbaeceolkmninlkfkhngl)](https://chromewebstore.google.com/detail/grovepin/jhekobecppdnbaeceolkmninlkfkhngl)


> Pin moments in any video, on any platform.

Grovepin is a Chrome extension that lets you drop timestamped notes on videos while watching — on YouTube, Vimeo, Coursera, Udemy, Loom, LinkedIn Learning, and more. No more pausing to open Notion. Press `N`, type your thought, resume.

## Features

- **Pin moments** — press `N` on any video page to capture a timestamped note. Video pauses while you type, resumes on save.
- **Works everywhere** — YouTube, Vimeo, Coursera, Udemy, Loom, LinkedIn Learning, Wistia, and any HTML5 video player
- **Site filtering** — only activates on known video sites by default. Enable on any site via the popup — one click, then reload.
- **Jump back** — click any timestamp to seek the video to that exact moment
- **AI summary** — after 7+ pins, summarise your notes into key points and revisit items with one click. 10 free summaries per month, no API key needed. Export notes as Markdown to summarise with any AI after the limit is reached.
- **Export** — exports pins and AI summary (if available) as Markdown
- **Pin limit** — up to 50 pins per session
- **Session history** — popup shows all past sessions across platforms, searchable
- **Dark mode** — follows system preference, or set manually in Settings (Light / Dark / Auto)
- **Collapse to pill** — hide the sidebar to a slim icon when you need full screen

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Pin current moment | `N` (while on a video page) |
| Open popup | `Ctrl/Cmd + Shift + Y` |
| Toggle sidebar | `Ctrl/Cmd + Shift + H` |

Change shortcuts at `chrome://extensions/shortcuts`

## Settings

Open via the popup's gear icon, or `chrome://extensions` → Grovepin → Details → Extension options.

| Setting | Default | Description |
|---|---|---|
| `theme` | `auto` | Light, dark, or auto (follows system preference) |
| `pinShortcut` | `n` | Key that captures a pin while watching |
| `summariseThreshold` | `7` | Minimum pins before AI summarise unlocks |
| `allowedDomains` | `youtube.com`, `vimeo.com`, `loom.com`, `coursera.org`, `udemy.com`, `linkedin.com`, `wistia.com`, `wistia.net`, `fast.wistia.com` | Domains where Grovepin activates. Add custom domains via popup or Settings page |

### Load unpacked (dev)
```bash
git clone https://github.com/umbrova/grovepin.git
cd grovepin
npm install
npm run build
```
Then open `chrome://extensions` → Enable Developer mode → Load unpacked → select `dist/`

## Tech stack

- **Vite** + `vite-plugin-web-extension` — MV3 multi-entry build
- **Svelte 5** + TypeScript — UI components
- **Hand-written component styles** (no CSS framework)
- **Manifest V3** — Chrome extension API
- **Cloudflare Workers** (via [grovepin-worker](https://github.com/umbrova/grovepin-worker)) — AI proxy with rate limiting

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

Feedback → [hello@umbrova.com](mailto:hello@umbrova.com?subject=Grovepin%20Feedback)  
Made by [Umbrova](https://umbrova.com)
