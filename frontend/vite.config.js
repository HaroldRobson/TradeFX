import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      buffer: 'buffer',
      util: 'util',
      process: 'process/browser',
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  optimizeDeps: {
    include: [
      'buffer', 
      'util', 
      'process',
      '@circle-fin/w3s-pw-web-sdk'
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
})