import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      zustand: path.resolve(__dirname, 'src/vendor/zustand.ts'),
      'zustand/shallow': path.resolve(__dirname, 'src/vendor/zustand.ts'),
    },
  },
})
