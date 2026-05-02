import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
        configure: (proxy) => {
          proxy.on('error', (err) => console.error('Proxy error:', err));
          proxy.on('proxyReq', (_, req) => console.log('Proxy ->', req.method, req.url));
          proxy.on('proxyRes', (res, req) => console.log('Proxy <-', res.statusCode, req.url));
        },
      },
    },
  },
});
