import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const SERVER = `http://127.0.0.1:${process.env.SERVER_PORT ?? 8787}`

export default defineConfig({
  plugins: [react()],
  // La oficina 3D se carga en diferido: sin esto Vite descubre three a mitad de sesión y duplica React.
  optimizeDeps: { include: ['three', '@react-three/fiber', '@react-three/drei'] },
  // three va en su propio chunk diferido; supera los 500 kB por diseño.
  build: { chunkSizeWarningLimit: 1000 },
  server: {
    port: 5173,
    proxy: {
      '/api': SERVER,
      '/ws': { target: SERVER.replace('http', 'ws'), ws: true },
    },
  },
})
