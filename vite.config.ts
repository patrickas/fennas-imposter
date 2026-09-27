import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/',
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Only needed inside the container: file events don't cross the Windows bind mount.
    watch: { usePolling: true, interval: 1000 },
  },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
})
