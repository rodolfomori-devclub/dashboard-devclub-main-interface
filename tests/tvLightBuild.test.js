import test from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { tvLightConfigSource, tvLightPlugin } from '../src/lib/tvLightBuild.js'

test('TV Light config carries only the public API base and remains a classic script', () => {
  const apiUrl = 'https://api.example.com/api?test="</script>\u2028'
  const context = { window: {} }
  const source = tvLightConfigSource(apiUrl)
  assert(!source.includes('</script>'))
  assert(!source.includes('\u2028'))
  runInNewContext(source, context)
  assert.deepEqual(Object.keys(context.window), ['TV_LIGHT_API_URL'])
  assert.equal(context.window.TV_LIGHT_API_URL, apiUrl)
  const fallback = { window: {} }
  runInNewContext(tvLightConfigSource(), fallback)
  assert.equal(fallback.window.TV_LIGHT_API_URL, 'http://localhost:3000/api')
})

test('production build emits config inside the independently served TV Light directory', () => {
  let asset
  tvLightPlugin('/api').generateBundle.call({ emitFile(value) { asset = value } })
  assert.equal(asset.fileName, 'tv-light/config.js')
  const context = { window: {} }
  runInNewContext(asset.source, context)
  assert.equal(context.window.TV_LIGHT_API_URL, '/api')
})

test('dev and preview routes load the standalone document while retaining real assets', () => {
  for (const hook of ['configureServer', 'configurePreviewServer']) {
    let middleware
    tvLightPlugin('/api')[hook]({ middlewares: { use(fn) { middleware = fn } } })
    for (const url of ['/tv-light', '/tv-light/', '/tv-light/abcdefghijklmnop']) {
      const req = { url }; let next = false
      middleware(req, {}, () => { next = true })
      assert.equal(req.url, '/tv-light/index.html')
      assert(next)
    }
    for (const url of ['/login', '/tv', '/tv-light/app.js', '/tv-light/style.css']) {
      const req = { url }
      middleware(req, {}, () => {})
      assert.equal(req.url, url)
    }
    const headers = {}; let body
    middleware({ url: '/tv-light/config.js' }, { setHeader(k, v) { headers[k] = v }, end(value) { body = value } }, () => assert.fail('config must be handled'))
    assert.equal(headers['Cache-Control'], 'no-store')
    assert.match(headers['Content-Type'], /javascript/)
    assert.equal(body, tvLightConfigSource('/api'))
  }
})
