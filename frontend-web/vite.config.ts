import path from 'node:path';
import fs from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** Copia index.html para 404.html no build — CDN/servidor estático (ex.: CloudFront/S3) pode servir 404.html em rotas inexistentes, permitindo SPA routing */
function copyIndexTo404() {
  return {
    name: 'copy-index-to-404',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      const indexPath = path.join(outDir, 'index.html');
      const notFoundPath = path.join(outDir, '404.html');
      if (fs.existsSync(indexPath)) {
        fs.copyFileSync(indexPath, notFoundPath);
        console.log('Copied index.html to 404.html for SPA fallback');
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyIndexTo404()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React runtime — compartilhado por todos os portais
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          // TanStack Query — separado para não bloquear landing page
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          // Daily.co — vídeo (só portal médico, ~300 kB)
          if (id.includes('@daily-co/daily')) return 'vendor-daily';
          // Chart.js — gráficos (admin)
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'vendor-chart';
          // SignalR — real-time (portal médico)
          if (id.includes('@microsoft/signalr')) return 'vendor-signalr';
          // Radix primitives (portal médico e admin)
          if (id.includes('@radix-ui/')) return 'vendor-radix';
          // UI libs
          if (id.includes('framer-motion') || id.includes('sonner') || id.includes('lucide-react')) {
            return 'vendor-ui';
          }
        },
      },
    },
  },
  // PWA: Vite copies everything in /public to dist/ automatically
  publicDir: 'public',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    env: {
      VITE_API_URL: 'https://api.test.example.com',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', 'src/test/', '**/*.test.*', '**/*.spec.*'],
    },
  },
});
