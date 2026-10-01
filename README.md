# DevClub Workspace

Dashboard financeiro e operação comercial unificados, autenticados pelo Vault.

Use Node.js 22.18+ (24 recomendado) e npm.

```sh
npm ci
npm run dev
```

Configuração, migrações e limites das integrações estão no [guia de implantação](docs/WORKSPACE.md).

```sh
npm test
npm run test:ui
npm run build
```

O teste de navegador usa dados simulados e bloqueia conexões externas. `CHROME_EXECUTABLE` pode apontar para um Chromium/Chrome instalado.
