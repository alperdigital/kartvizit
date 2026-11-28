import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
  base: '/kartvizit/',
  build: {rollupOptions:{output:{manualChunks:{storage:["dexie"],validation:["zod"],phone:["libphonenumber-js"]}}}},
  plugins: [react(), tailwind(), VitePWA({
    registerType: 'prompt',
    strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts',
    includeAssets: ['icons/apple.png'],
    manifest: {
      id: '/kartvizit/', name: 'Kartvizit', short_name: 'Kartvizit', lang: 'tr',
      start_url: '/kartvizit/', scope: '/kartvizit/', display: 'standalone',
      theme_color: '#142b24', background_color: '#f5f2e9',
      icons: [
        {src:'icons/192.png', sizes:'192x192', type:'image/png'},
        {src:'icons/512.png', sizes:'512x512', type:'image/png'},
        {src:'icons/maskable.png', sizes:'512x512', type:'image/png', purpose:'maskable'},
      ],
    },
    injectManifest: { globPatterns: ['**/*.{js,css,html,png,webmanifest,txt}'], globIgnores: ['ocr/**'] },
  })],
})
