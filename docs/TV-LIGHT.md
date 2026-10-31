# Modo TV Light

Endereço canônico: `https://dashboard.launchcontrol.com.br/tv-light`.
O projeto que publica esse endereço é **dashboard-devclub-main-interface**;
`Dev/Modelo de Hub` é a origem histórica, não o frontend publicado.

A tela de configuração da TV oferece **Copiar TV Light** e **Abrir TV Light**
quando o link público está ativo. A versão Light segue a mesma programação,
período, base da meta e autorização pública de `/tv`. Desativar o acesso também
bloqueia `/tv-light` na atualização seguinte. Links anteriores com token de
16 caracteres podem usar `/tv-light/<token>`.

A página é independente do Workspace: HTML estático, JavaScript ES5 e XHR,
sem React, módulos JavaScript, fontes externas ou bibliotecas de gráficos.
Apresenta os onze painéis com números e tabelas simples; listas exibem os cinco
primeiros itens e informam quando existem mais. Bruto e cash collected permanecem
separados, dados ausentes não viram zero e leituras parciais ficam identificadas.
O preset **Modo diário** alterna total, cartão vs. boleto, cash collected e
vendedores de hoje. A tela de cash collected destaca esse valor e mantém o
valor das vendas como contexto. A data segue o horário de Brasília.

Atualiza normalmente a cada 30 segundos e tenta a cada 5 segundos quando a API
ainda está preparando os indicadores. Uma falha temporária mantém a última
leitura identificada; leituras com mais de cinco minutos são retiradas. Respostas
403, 404 ou 410 retiram os indicadores imediatamente.

## Build e publicação

`src/lib/tvLightBuild.js` gera `dist/tv-light/config.js` com somente a
`VITE_API_URL` pública do ambiente de build. Também gera `celebration-core.js`,
um script clássico ES5 com as mesmas regras de novas vendas da TV normal.
O Caddy serve `/tv-light` e seus
arquivos diretamente, com `no-store`, `no-referrer` e `noindex`, sem passar pelo
fallback do Workspace. O feed de comemorações vem da mesma API pública; não há
alteração no Vault ou necessidade de login.

```sh
npm test
npm run build
node tests/ui/tv-light-smoke.mjs
npm run deploy:check
```

A publicação segue o script Railway e o serviço fixados em
[WORKSPACE.md](./WORKSPACE.md#publicação-em-produção). A validação local usa
fixtures e verifica JavaScript ES5, navegação, falha/revogação e layout em
1280×720. Não substitui o teste na TV física, incluindo sua conexão HTTPS.

## Publicação verificada

Em 1 de outubro de 2026 (Brasília), o deployment Railway
`6ba3c16d-3b67-4801-b882-14d81cd7e996` do frontend concluiu com status `SUCCESS`.
O endereço público `/tv-light` respondeu HTTP 200 com `Cache-Control: no-store`
e exibiu indicadores da API pública (estado `ready`), carregando somente
`/tv-light/config.js` e `/tv-light/app.js`. A verificação foi repetida com
`fetch`, `AbortController`, `ResizeObserver`, `Intl`, `URL` e `URLSearchParams`
desativados, sem erros de JavaScript nem overflow em 1280×720. As rotas `/tv`
e `/login` também foram verificadas após a publicação. A TV Samsung física
ainda precisa ser testada pelo usuário.

## Comemorações de vendas

Combinação aprovada: **Chuva de confetes + Vitória, 100%, 5 segundos**.
O volume da aplicação fica fixo em 100%; ajuste o volume pelo computador ou pela TV.
Clique em **Ativar som** no aparelho para liberar áudio. **Testar comemoração**
exibe uma venda fictícia sinalizada, sem alterar dados. **Silenciar som** também
fica disponível durante o efeito. Quando o navegador não oferece áudio, os
confetes continuam funcionando.

O nome aparece quando houver vendedor identificado. A primeira leitura é
silenciosa; apenas vendas novas do dia, com horário real, entram na fila.
Atualizações repetidas não duplicam alertas. Ocultar a página ou perder a
conexão descarta a fila, e a recuperação não toca um histórico acumulado.
Veja as regras completas em [TV Mode](./TV-MODE.md#comemorações-nas-vendas-reais).
