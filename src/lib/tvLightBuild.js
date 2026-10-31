import { readFileSync } from 'node:fs'

// Read the canonical ES5 source before Vite bundles its config: function.toString
// would serialize esbuild's modern object shorthand and break older TVs.
export const tvLightCelebrationSource = () => `${readFileSync(new URL('../components/tv/celebration/liveSaleTracker.js', import.meta.url), 'utf8')
  .replace('export function createTvSaleTracker()', 'window.createTvSaleTracker = function createTvSaleTracker()')};\n`

// Only the public API base is exposed. No Vault session/config is needed by TV.
export function tvLightConfigSource(apiUrl = 'http://localhost:3000/api') {
  const safe = JSON.stringify(apiUrl).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  return `window.TV_LIGHT_API_URL = ${safe};\n`
}

export function tvLightPlugin(apiUrl) {
  const source = tvLightConfigSource(apiUrl)
  const celebrationSource = tvLightCelebrationSource()
  const middleware = (req, res, next) => {
    const pathname = (req.url || '').split('?')[0]
    if (pathname === '/tv-light/celebration-core.js') {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(celebrationSource)
      return
    }
    if (pathname === '/tv-light/config.js') {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(source)
      return
    }
    if (/^\/tv-light(?:\/[^.]*)?\/?$/.test(pathname)) req.url = '/tv-light/index.html'
    next()
  }
  return {
    name: 'tv-light-static',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'tv-light/config.js', source })
      this.emitFile({ type: 'asset', fileName: 'tv-light/celebration-core.js', source: celebrationSource })
    },
  }
}
