import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  appType: 'mpa',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src/react'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/echarts/')) return 'echarts-core';
          if (
            id.includes('/node_modules/echarts-for-react/') ||
            id.includes('/node_modules/fast-deep-equal/') ||
            id.includes('/node_modules/size-sensor/') ||
            id.includes('/node_modules/tslib/')
          ) return 'echarts-react';
          return undefined;
        }
      }
    }
  },
  server: {
    host: '0.0.0.0'
  },
  preview: {
    host: '0.0.0.0'
  }
});
