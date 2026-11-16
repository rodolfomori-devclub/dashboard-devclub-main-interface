import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const project = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(new URL('../package.json', import.meta.url))
let runtime, directory

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'legacy-charts-test-'))
  const contents = `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import LaunchDetail from '${project}src/components/LaunchDetailModal.jsx'; export { React, renderToStaticMarkup, LaunchDetail };`
  const result = await build({ stdin: { contents, resolveDir: project, sourcefile: 'legacy-charts-test.jsx', loader: 'jsx' }, bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic', plugins: [{ name: 'external-package-paths', setup(builder) {
    builder.onResolve({ filter: /^[^./]/ }, args => args.path.startsWith('node:') ? undefined : ({ path: require.resolve(args.path), external: true }))
  } }] })
  const entry = join(directory, 'entry.mjs')
  await writeFile(entry, result.outputFiles[0].text)
  runtime = await import(entry)
})

after(async () => { if (directory) await rm(directory, { recursive: true, force: true }) })

test('launch details render nonempty investment and revenue charts without an undefined palette', () => {
  const metrics = { investment: 100, revenue: 300, profit: 200, roi: 3, leads: 10, leadCost: 10,
    facebookInvestment: 30, googleInvestment: 50, guruRevenue: 120, tmbRevenue: 150 }
  assert.doesNotThrow(() => runtime.renderToStaticMarkup(runtime.React.createElement(runtime.LaunchDetail, {
    open: true, onClose: () => {}, launchName: 'Fixture', launchData: [{ id: 'fixture' }], metrics,
  })))
})
