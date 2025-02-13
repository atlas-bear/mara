import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/flash-report/',
  build: {
    outDir: '../dist/flash-report',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
})