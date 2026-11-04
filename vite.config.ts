import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // The review-loop hooks keep their tests next to them [TAN-34].
    include: ['src/**/*.test.{ts,tsx}', '.claude/hooks/**/*.test.ts'],
  },
})
