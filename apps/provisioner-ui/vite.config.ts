import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { existsSync, copyFileSync } from 'fs'

// Copy favicon.svg to favicon.ico at build time
const srcFavicon = resolve(__dirname, 'public/favicon.svg')
const destFavicon = resolve(__dirname, 'public/favicon.ico')
if (existsSync(srcFavicon)) {
  copyFileSync(srcFavicon, destFavicon)
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  }
})
