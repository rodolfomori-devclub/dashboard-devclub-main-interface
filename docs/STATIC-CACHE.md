# Cache do frontend estático

O Railway usa Railpack para compilar o Vite e Caddy para servir `/app/dist`. A configuração consultada no container de produção em 1º de outubro de 2026 era o template padrão do Railpack 0.40.1, com Caddy 2.11.4: não emitia `Cache-Control` e aplicava o fallback `/index.html` também a arquivos inexistentes em `/assets`.

O `Caddyfile` da raiz substitui o template, conforme o [contrato de sites estáticos do Railpack](https://railpack.com/languages/node/#static-sites), preservando porta, compressão, healthcheck, proxies confiáveis e cabeçalhos de segurança.

| Resposta | Política |
| --- | --- |
| HTML e rotas diretas, incluindo `/callback` | `no-cache, max-age=0, must-revalidate`; mantém ETag e 304 |
| Arquivo existente em `/assets` com hash no nome | `public, max-age=31536000, immutable` |
| Arquivo estático sem hash | Revalidação obrigatória |
| Arquivo ausente em `/assets` | 404, `no-store`, sem conteúdo HTML da SPA |

A regra de cache permanente exige simultaneamente um nome com hash e um arquivo existente. Ela não transforma erros em respostas cacheadas por um ano. O script `npm run deploy` inclui o `Caddyfile` no payload autorizado, para preservar o comportamento também em publicação pela CLI.

## Validação local

Com Docker disponível:

```sh
node tests/infra/static-cache-smoke.mjs
node --test tests/deploymentPayload.test.js
```

O smoke usa a imagem oficial `caddy:2.11.4-alpine`, arquivos sintéticos e porta aleatória somente em loopback. Valida HTML em `/`, `/metas`, `/pace` e `/callback`, resposta condicional 304, troca de HTML seguida de 200, GET/HEAD de assets presentes/ausentes e inclusão da configuração no payload. O container e os arquivos temporários são removidos ao terminar.

Esses cabeçalhos atuam nas próximas navegações e consultas. Uma aba que já executa JavaScript antigo precisa recarregar para trocar de versão; a política não concede permissões, altera tokens ou desativa autenticação.
