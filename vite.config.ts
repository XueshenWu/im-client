import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        // Entry point for the Electron main process
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
            
            },
          },
        },
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
