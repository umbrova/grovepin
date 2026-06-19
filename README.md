# Grovepin

Pin moments in any video, on any platform.

## Stack

- Vite + `@crxjs/vite-plugin` — MV3 multi-entry build
- Svelte 5 + TypeScript
- Tailwind CSS + DaisyUI (popup/options)
- shadcn-svelte (sidebar, inside Shadow DOM)
- Zod — AI response validation
- Anthropic Claude Haiku — summarise only

## Setup

```bash
npm install
npm run dev      # watch mode — reload unpacked from dist/
npm run build    # production build
```

## Load in Chrome

1. `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the `dist/` folder

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Open popup | `Cmd/Ctrl + Shift + G` |
| Pin moment (sidebar focused on video page) | `N` |

To change the open-popup shortcut: `chrome://extensions/shortcuts`

## Project structure

```
src/
  background/     service worker — storage + AI message router
  content/        injected into video pages
    sidebar/      Svelte sidebar (Shadow DOM)
  popup/          toolbar popup
  options/        settings page
  lib/
    ai.ts         Anthropic API call + Zod validation
    storage.ts    typed chrome.storage wrappers
    video.ts      platform detection, video element utils
    export.ts     markdown export
  types/          shared TypeScript interfaces
```

## Adding API key

Open popup → Settings gear → paste Anthropic API key.
Key is stored in `chrome.storage.local` — never sent anywhere except Anthropic.
