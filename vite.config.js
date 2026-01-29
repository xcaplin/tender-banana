import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use dynamic base path:
  // - GitHub Pages: /tender-banana/
  // - Vercel: / (root)
  // Set VITE_BASE env variable to override
  base: process.env.VITE_BASE || '/tender-banana/',
})
