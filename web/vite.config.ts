import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const SERVER = `http://127.0.0.1:${process.env.SERVER_PORT ?? 8787}`

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': SERVER,
      '/ws': { target: SERVER.replace('http', 'ws'), ws: true },
    },
  },
})
