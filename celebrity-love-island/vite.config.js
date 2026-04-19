import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    base: '/', // for Vercel deployment
    setupFiles: './src/test/setup.js',
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
