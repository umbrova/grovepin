import type { Config } from 'tailwindcss'
import daisyui from 'daisyui'

export default {
  content: ['./src/**/*.{html,ts,svelte}'],
  theme: {
    extend: {
      colors: {
        grove: {
          50:  '#EAF3DE',
          100: '#C0DD97',
          200: '#97C459',
          400: '#639922',
          600: '#3B6D11',
          800: '#27500A',
          900: '#173404',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        grovepin: {
          'primary':          '#3B6D11',
          'primary-content':  '#EAF3DE',
          'secondary':        '#1D9E75',
          'accent':           '#7F77DD',
          'neutral':          '#2C2C2A',
          'base-100':         '#ffffff',
          'base-200':         '#f5f5f3',
          'base-300':         '#ebebea',
          'base-content':     '#1a1a18',
          'info':             '#378ADD',
          'success':          '#639922',
          'warning':          '#BA7517',
          'error':            '#D85A30',
        },
      },
      'dark',
    ],
    darkTheme: 'dark',
  },
} satisfies Config
