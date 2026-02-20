import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/leads-proxy': {
        target: 'https://api-production-328ad.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/leads-proxy/, '/api'),
      },
      '/monitoring-proxy': {
        target: 'https://smart-ads-api-gazrm25mda-uc.a.run.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/monitoring-proxy/, '/monitoring'),
      },
    },
  },
})