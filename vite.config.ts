import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import webExtension from 'vite-plugin-web-extension'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    svelte(),
    webExtension({
      manifest: () => ({
        ...require('./manifest.json'),
        action: {
          default_popup: 'src/popup/index.html',
        },
        options_ui: {
          page: 'src/options/index.html',
          open_in_tab: true,
        },
      }),
      additionalInputs: [
        'src/popup/index.html',
        'src/options/index.html',
      ],
    }),
  ],
  resolve: {
    alias: {
      '$lib':   resolve(__dirname, 'src/lib'),
      '$types': resolve(__dirname, 'src/types'),
    },
  },
})