import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      // Backend at /api, override via CV_BE_PORT or VITE_CV_BE_PORT env.
      '/api': {
        target: `http://127.0.0.1:${process.env.CV_BE_PORT || process.env.VITE_CV_BE_PORT || '8765'}`,
        changeOrigin: true,
      },
    },
  },
});
