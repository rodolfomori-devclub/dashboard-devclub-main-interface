import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { tvLightPlugin } from './src/lib/tvLightBuild.js'
const path = relative => fileURLToPath(new URL(relative, import.meta.url))
export default defineConfig(({ mode }) => ({
 plugins:[react(), tvLightPlugin(loadEnv(mode, path('.'), 'VITE_').VITE_API_URL)],
 resolve:{alias:{'@diag':path('./src/hub/lib/diagnostic/core'),'@':path('./src/hub')}},
 server:{host:'127.0.0.1',port:3001},
 // sessao.html: the lead's shared window (Apoio Vendas), a page without the app shell.
 build:{chunkSizeWarningLimit:1000,rollupOptions:{input:{main:path('./index.html'),sessao:path('./sessao.html')},output:{onlyExplicitManualChunks:true,manualChunks(id){
   if(id.includes('node_modules')) {
     if(id.includes('recharts')||id.includes('d3-')) return 'charts'
     if(id.includes('@tiptap')||id.includes('prosemirror')) return 'editor'
     if(id.includes('jspdf')) return 'pdf'
     if(id.includes('html2canvas')||id.includes('html2pdf')) return 'pdf-renderer'
     if(id.includes('/xlsx/')) return 'spreadsheets'
   }
 }}}},
}))
