import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Only VITE_* variables reach the browser. Never put secrets in them.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_DEV_API_PROXY || 'http://localhost:4000', changeOrigin: true }, '/socket.io': { target: process.env.VITE_DEV_API_PROXY || 'http://localhost:4000', ws: true } },
  },
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.js'], globals: true },
});
