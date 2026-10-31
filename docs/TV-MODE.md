# TV Mode

Abra **Ranking e TV → TV Mode**. O ranking comercial anterior continua na outra aba.

Administradores usam **Configurar TV** para escolher painéis, ordem, duração (10–120 segundos), modo fixo ou alternância, base (bruto, cash collected ou quantidade), mês e tema. Há cinco pontos de partida: Modo diário, Visão da operação, Comercial, Metas e Produtos. Alterações só entram em vigor ao salvar.

**Configurar TV → Modo diário → Salvar programação → Iniciar TV** prepara uma sequência de quatro telas, com 20 segundos cada: Vendas do dia (total e horas), Cartão vs. boleto do dia, Cash collected do dia e Top vendedores do dia. O preset seleciona o mês atual, ativa a alternância e ordena pelo valor das vendas; preserva o tema. Os recortes acompanham a virada do dia e do mês em Brasília, sem somar dias anteriores. A tela de cash dá destaque ao cash collected, mantendo o valor das vendas visível. Guru e Hotmart são classificados em Cartão; TMB e Boletex, em Boleto, inclusive lançamentos manuais dessas plataformas e independentemente do meio original. As demais fontes preservam o meio informado. A mesma categoria é usada no Diário, mensal, anual, filtros e comparativos. A mesma programação funciona na TV pública e na TV Light. Configurações anteriores recebem os novos painéis desativados.

Os onze painéis são Meta do mês, Ritmo da meta, Metas dos times, Metas dos produtos, Top vendedores, Top produtos, Vendas do dia, Meios de pagamento e os três novos recortes diários. O gráfico de pace permite selecionar geral, time, produto ou vendedor. Todos os painéis diários só exibem o dia atual de Brasília quando ele pertence ao mês escolhido.

**Iniciar TV** abre a apresentação. Se o navegador não oferecer tela cheia nativa, a apresentação ocupa a janela. Setas navegam, espaço pausa e Escape sai; também existem botões. A navegação por teclado dentro do gráfico é preservada. Aba oculta pausa a alternância.

## Link público

O cartão **Link público da TV**, visível aos administradores nesta mesma tela, permite ativar e copiar o endereço fixo **https://dashboard.launchcontrol.com.br/tv**, fácil de digitar em outro aparelho. Ele abre diretamente a programação, sem conta ou login no Vault. Um botão permite entrar em tela cheia após abrir o link no aparelho.

O endereço `/tv` é público enquanto estiver ativo e mostra os indicadores escolhidos pelo administrador. **Desativar link** interrompe o acesso público; **Ativar link público** restaura o mesmo endereço. Os links anteriores com código continuam compatíveis enquanto o respectivo token estiver ativo. Aparelhos já conectados removem os indicadores ao detectar a revogação, na próxima atualização. A programação continua compartilhada e só o admin pode editá-la.

A página pública não carrega o Workspace privado, SDK ou sessão do Vault. Usa `GET /api/tv/public`, sem cookies nem Authorization. Os links antigos usam `GET /api/tv/public/:token`, mantendo as mesmas verificações de ativação e revogação. O servidor calcula os mesmos indicadores e projeta apenas os campos usados pelos painéis ativos; no modo fixo, apenas o painel fixo. Não envia transações, clientes, e-mails, UTMs, diretório, IDs internos ou notas de metas.

Os cálculos puros são sincronizados no repositório da API, em `src/services/tvModel`, com manifestos de hashes e teste de paridade. Alterações financeiras futuras devem sincronizar as duas cópias na mesma entrega.

## Acesso e persistência

- A sessão e o menu `ranking` continuam sob controle do Vault.
- Os indicadores exigem também um dos menus `today`, `daily`, `monthly`, `yearly`, `goal-pace` ou `goals`. Administradores têm acesso. Apenas `ranking` mantém acesso ao ranking comercial sem consultar endpoints financeiros.
- `GET /api/tv/settings` lê a programação compartilhada; `PUT` é exclusivo de administradores. `GET/POST /api/tv/share` administra o link e também exige admin. O campo `simplePath` informa `/tv` quando ativo; `token` e `path` são preservados para compatibilidade com clientes antigos.
- `dashboard_tv_settings` guarda uma configuração para o Workspace. A migração `20261001_tv_settings.sql`, no repositório da API, deve ser aplicada antes do frontend.
- A migração `20261001_tv_public_links.sql` cria a tabela privada do link, inicialmente sem acesso público ativo. A criação é uma ação explícita do administrador ou uma ativação operacional autorizada. Rota pública responde 404 a links desconhecidos/desativados, revalida após o carregamento dos dados e não aceita parâmetros para alterar período, indicador ou painéis.
- Revisão otimista impede sobrescrever a edição de outro administrador. No conflito, o rascunho fica visível e o administrador pode carregar a versão mais recente.
- TVs abertas verificam a programação a cada minuto. Uma revisão inalterada não reinicia a sequência.

## Dados

Todos os painéis usam o mesmo carregador do cache de períodos e o mesmo ledger de atribuições. O mês corrente muda automaticamente no horário de Brasília. Atualizações visíveis ocorrem a cada minuto, sem uma consulta por painel. Consultas simultâneas são deduplicadas e as obsoletas canceladas.

A atualização é automática por consulta periódica, sujeita ao cache e ao tempo de coleta das plataformas. A TV Light consulta a cada 30 segundos. A TV normal e a Light comemoram novas vendas detectadas com **Chuva de confetes**, som **Vitória**, volume **100%**, ajustado pelo computador e duração **5 segundos**. As celebrações do ranking comercial são independentes.

Cash collected preserva Guru/Hotmart líquidos integrais, TMB em 40% por venda e entradas conhecidas de novos contratos Asaas. Recebimentos de faturas antigas ficam fora. Manuais conciliadas não duplicam vendas nativas. Vendas sem vendedor identificado não recebem atribuição fictícia.

Valores indisponíveis são diferentes de zero. Atualização com falha pode preservar a última leitura do mesmo mês, marcada como parcial. Um pace parcial não recebe diagnóstico definitivo de adiantado/atrasado. Metas ausentes não são estimadas. Comparações e rankings exibem até oito itens, com indicação de truncamento e valores sem atribuição.

## Validação

- `npm test`: regressões financeiras, identificação, escopos, datas de Brasília e estado parcial.
- `node tests/ui/tv-mode-smoke.mjs`: editor, persistência, concorrência, permissões, todos os painéis, alternância, pausa, teclado, fallback de tela cheia, períodos, temas e responsividade, com API e sessão sintéticas.
- `node tests/ui/tv-public-smoke.mjs`: acesso anônimo, sessões antigas ignoradas, ausência de APIs privadas, revogação, atualização, falhas e dispositivos móveis.
- `node tests/ui/tv-celebration-smoke.mjs`: prévia de comemorações, três animações, quatro sons, nome opcional, volume, teclado, tela cheia, preferências locais e isolamento dos dados reais.
- `node tests/ui/tv-live-celebrations-smoke.mjs`: comemorações reais no player privado/público com APIs sintéticas, primeira leitura silenciosa, atualização, fila, deduplicação, áudio, recuperação e teste sem gravações.
- `npm run test:ui`: inclui TV e as regressões das demais telas.

O cenário de regressão da TV mantém R$ 833,64 de Hotmart e R$ 400,00 de cash TMB como R$ 1.233,64, excluindo R$ 1.255,36 de faturas Asaas. Os valores do teste não são dados de produção.

## Publicação do preset diário

Publicado em 19 de outubro de 2026 (Brasília), com deployments Railway `e358e95c-311f-4acc-82d3-0eb1ec60ec0a` (API) e `dd1ff7db-3357-4a1e-b2ee-64c15c6937bf` (frontend), ambos `SUCCESS`. Não exige migração de banco. A programação compartilhada foi preservada; o administrador ativa o preset pelo editor.

Validação local: 216 testes do frontend e 307 da API; os 15 scripts de navegação foram aprovados (os dois últimos reexecutados após corrigir uma espera de redimensionamento no teste de comissões). TV Light também validada separadamente. A verificação anônima em produção confirmou `/tv` e `/tv-light` com valores correspondentes à API, login pelo Vault e ausência de erros de JavaScript ou de carregamento de arquivos.

Os testes sobre os arquivos publicados também passaram: editor/player privado (19 verificações), TV pública (17) e TV Light (15), usando APIs simuladas sem alterar dados ou programação reais. Entrada publicada: `/assets/main-qjyC6OHm.js`.

## POC de comemorações

A prévia está em `/tv-demo`, sem login, e no botão **Testar animações e sons** do editor da TV. Usa apenas vendas fictícias: não consulta APIs, não detecta vendas reais e não altera a programação compartilhada.

Combine **Chuva de confetes**, **Vendedor em destaque** ou **Faixa discreta** com **Vitória**, **Arcade**, **Festa** ou **Caixa registradora**. Os sons são sintetizados no navegador e começam somente após um clique. Volume, silêncio e interrupção imediata estão disponíveis. A prévia dura cinco segundos; a música pode terminar antes.

Edite o nome e o valor em **Venda de exemplo**, ou desmarque **Mostrar vendedor** para uma venda sem atribuição. **Simular venda** e **Testar combinação** exibem a combinação escolhida; **Ouvir** testa somente o som. Há tela cheia e suporte à preferência de movimento reduzido.

**Guardar minha escolha** salva apenas animação, som, volume e silêncio neste navegador. **Copiar escolha** prepara um resumo para confirmar a combinação na conversa. Nome e valor fictícios não são persistidos. Alterar a POC não muda a combinação aprovada nas TVs reais.

Publicada em 19 de outubro de 2026, no deployment frontend `97db8cbe-92c3-4189-a916-25693c1e594d` (`SUCCESS`), entrada `/assets/main-DsQ20LAT.js`. Não houve mudança na API ou no banco para esta POC. Os 222 testes unitários, os 15 scripts de interface existentes e os 11 grupos da POC passaram. O novo smoke foi incluído no runner. A rodada contra os arquivos publicados confirmou os mesmos 11 grupos, sem erros de JavaScript ou chamadas privadas. A leitura real de `/tv` e `/tv-light` confirmou os valores da API; login e ranking permaneceram disponíveis.

## Comemorações nas vendas reais

A combinação aprovada é **Chuva de confetes + Vitória, 100%, 5 segundos**, aplicada a `/tv`, links públicos antigos, apresentação privada e `/tv-light`. O valor segue a mesma política financeira dos indicadores. O nome aparece apenas quando a venda tem atribuição a um vendedor identificado no cadastro. Vendas sem vendedor mostram **Venda confirmada**.

Em 20/10/2026, o volume das TVs foi fixado em 100%, com ajuste pelo computador. Publicação Railway `0a522bd4-7ddd-48c6-bdf3-34009caefdf1` concluída com `SUCCESS`. Passaram 251 testes unitários, os 17 scripts de interface e, nos assets publicados com dados sintéticos, 16 verificações da TV normal e 20 da TV Light. Páginas que já estavam abertas precisam ser recarregadas para receber o novo volume.

Abra a TV e clique em **Ativar som**. É necessário um gesto neste aparelho para o navegador liberar áudio; recarregar a página exige ativá-lo novamente. **Silenciar som** interrompe imediatamente a música e mantém os efeitos visuais. **Testar comemoração** mostra **Venda de teste**, sem cadastrar venda, alterar totais ou enviar gravações à API. O teste reproduz som somente quando ativado.

A primeira leitura estabelece a referência e permanece silenciosa. Só entram na fila novas identidades de venda do dia de Brasília, com horário real posterior a essa referência e até dez minutos de idade. Repetições, correções de valor/vendedor, faturas antigas, agregados, cancelamentos, reembolsos e manuais conciliadas não geram comemorações. Registros sem horário exato, incluindo entradas manuais que só informam o dia, continuam nos indicadores mas não produzem alertas.

Cada venda ocupa cinco segundos, em sequência, com pausa na alternância dos painéis. A fila mantém até cem vendas recentes. Ocultar a aba, perder a conexão, revogar o link ou mudar o dia descarta os alertas pendentes; a próxima leitura estabelece uma nova referência. A recarga normal e breve do cache preserva a referência por até dois minutos, sem disparar eventos do cache antigo. A recuperação de uma fonte indisponível permanece silenciosa.

O feed público contém apenas o dia, estados das fontes e até duzentas identidades opacas por fonte com horário, valor e nome opcional do vendedor. Não inclui pedidos originais, clientes, e-mails, UTMs ou informações de atribuição. A TV Light usa as mesmas regras de identificação e deduplicação por um script clássico gerado a partir do código comum, mantendo compatibilidade com navegadores sem módulos.

Publicação verificada em 19 de outubro de 2026: API `5197e8b5-ae9c-4a17-86b9-e7b6be828605` e frontend `2ecdff6f-6380-4594-a8b0-c32a7ce27e07`, ambos `SUCCESS`; entrada `/assets/main-BJ9g3p8C.js`. Sem migração ou alteração na programação compartilhada. Passaram 240 testes do frontend, 312 da API, todos os 17 scripts de interface (os de TV foram reexecutados após ajustar o espaço dos controles) e os 20 grupos da Light. Sobre os arquivos publicados passaram os 16 grupos de comemorações públicas/privadas e os 20 da Light, com APIs sintéticas e sem gravações reais. A leitura real confirmou o ciclo de cache `ready → refreshing → ready`, identidades estáveis, os valores diários da TV normal/Light e as rotas de login/ranking, sem erros de JavaScript.
