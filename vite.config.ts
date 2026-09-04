import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Manifest + service worker so the app installs from Chrome as a desktop
    // app. Everything in dist/ is precached; updates apply on the next launch.
    // PNG icons are added in phase 5; the SVG is enough for Chrome until then.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Piece Grader',
        short_name: 'Grader',
        description: 'Grades pitch and timing of a piano piece played over MIDI',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
