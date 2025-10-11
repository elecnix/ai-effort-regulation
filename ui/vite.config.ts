import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:6740',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:6740',
        changeOrigin: true,
      },
      '/message': {
        target: 'http://localhost:6740',
        changeOrigin: true,
      },
      '/conversations': {
        target: 'http://localhost:6740',
        changeOrigin: true,
      },
      '/stats': {
        target: 'http://localhost:6740',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:6740',
        changeOrigin: true,
      },
    },
  },
})
