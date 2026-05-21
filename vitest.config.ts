import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'src/__tests__/e2e'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/__tests__/**',
        'src/lib/types/**',
        'src/components/ui/**',
        'src/lib/supabase/**',
        'src/lib/data/**',
        'src/proxy.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
        perFile: true,
      },
      // Override thresholds for critical files
      watermarks: {
        lines: [50, 80],
        functions: [50, 80],
        branches: [40, 70],
        statements: [50, 80],
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
