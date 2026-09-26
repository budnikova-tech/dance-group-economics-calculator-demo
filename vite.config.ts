import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/dance-group-economics-calculator-demo/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
