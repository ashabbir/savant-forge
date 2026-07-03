import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/renderer/test/setup.ts'],
    poolOptions: {
      threads: {
        execArgv: ['--no-webstorage']
      }
    },
    coverage: {
      provider: 'v8',
      include: ['src/renderer/**/*.{ts,tsx}'],
      exclude: [
        'src/renderer/main.tsx',
        'src/renderer/vite-env.d.ts',
        'src/renderer/test/**/*',
        'src/renderer/shellTypes.ts'
      ]
    }
  }
})
