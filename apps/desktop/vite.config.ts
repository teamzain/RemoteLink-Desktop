import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': { target: 'http://159.65.84.190', changeOrigin: true },
      '/devices': { target: 'http://159.65.84.190', changeOrigin: true },
    },
  },
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['ws', 'bufferutil', 'utf-8-validate', 'node-datachannel', '@remotelink/native-capture', '@remotelink/native-input']
            }
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload'
          },
        },
      },
    ]),
    renderer({
      nodeIntegration: true,
    }),
  ],
});
