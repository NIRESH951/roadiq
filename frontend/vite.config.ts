import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API = process.env.ROADIQ_API ?? 'http://localhost:8000'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/api': API, '/static': API, '/uploads': API },
  },
  preview: {
    proxy: { '/api': API, '/static': API, '/uploads': API },
  },
  build: { chunkSizeWarningLimit: 1600 },
})
