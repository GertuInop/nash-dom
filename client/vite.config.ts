import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/server': {
        target: 'http://127.0.0.1:3080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
