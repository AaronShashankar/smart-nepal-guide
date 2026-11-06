import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Internal admin tool: Mantine + MapLibre make big chunks; the map is already lazy-loaded.
  build: { chunkSizeWarningLimit: 1000 },
})
