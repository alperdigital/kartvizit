import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root:'artifact',
  base:'./',
  plugins:[react()],
  build:{outDir:'../work-artifact',emptyOutDir:true,rollupOptions:{output:{inlineDynamicImports:true}}},
})
