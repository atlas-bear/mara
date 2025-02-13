import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/weekly-report/',
  build: {
    outDir: '../dist/weekly-report',
    emptyOutDir: true,
  },
})