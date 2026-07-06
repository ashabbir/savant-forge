import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  publicDir: 'src/renderer/public',
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3']
            }
          }
        }
      },
      preload: {
        input: path.join(__dirname, 'src/main/electron/preload.ts')
      }
    }),
    renderer()
  ],
  server: {
    port: 5173,
    strictPort: false
  }
})
