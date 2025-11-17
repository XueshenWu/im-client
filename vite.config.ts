import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
import path from 'path'

export default defineConfig({
  plugins: [
    electron({
      main: {
        // Entry point for the Electron main process
        entry: 'electron/main.ts',
      },
      preload: {
        // Entry point for the preload script
        input: 'electron/preload.ts',
      },
      // Enable electron-renderer for better renderer process integration
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
