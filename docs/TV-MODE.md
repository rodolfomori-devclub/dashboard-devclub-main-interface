# TV Mode

Abra **Ranking e TV → TV Mode**. O ranking comercial anterior continua na outra aba.

Administradores usam **Configurar TV** para escolher painéis, ordem, duração (10–120 segundos), modo fixo ou alternância, base (bruto, cash collected ou quantidade), mês e tema. Há quatro pontos de partida: Visão da operação, Comercial, Metas e Produtos. Alterações só entram em vigor ao salvar.

Os oito painéis são Meta do mês, Ritmo da meta, Metas dos times, Metas dos produtos, Top vendedores, Top produtos, Vendas do dia e Meios de pagamento. O gráfico de pace permite selecionar geral, time, produto ou vendedor. Vendas do dia só exibe o dia atual de Brasília quando ele pertence ao mês escolhido.

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

Cash collected preserva Guru/Hotmart líquidos integrais, TMB em 40% por venda e entradas conhecidas de novos contratos Asaas. Recebimentos de faturas antigas ficam fora. Manuais conciliadas não duplicam vendas nativas. Vendas sem vendedor identificado não recebem atribuição fictícia.

Valores indisponíveis são diferentes de zero. Atualização com falha pode preservar a última leitura do mesmo mês, marcada como parcial. Um pace parcial não recebe diagnóstico definitivo de adiantado/atrasado. Metas ausentes não são estimadas. Comparações e rankings exibem até oito itens, com indicação de truncamento e valores sem atribuição.

## Validação

- `npm test`: regressões financeiras, identificação, escopos, datas de Brasília e estado parcial.
- `node tests/ui/tv-mode-smoke.mjs`: editor, persistência, concorrência, permissões, todos os painéis, alternância, pausa, teclado, fallback de tela cheia, períodos, temas e responsividade, com API e sessão sintéticas.
- `node tests/ui/tv-public-smoke.mjs`: acesso anônimo, sessões antigas ignoradas, ausência de APIs privadas, revogação, atualização, falhas e dispositivos móveis.
- `npm run test:ui`: inclui TV e as regressões das demais telas.

O cenário de regressão da TV mantém R$ 833,64 de Hotmart e R$ 400,00 de cash TMB como R$ 1.233,64, excluindo R$ 1.255,36 de faturas Asaas. Os valores do teste não são dados de produção.
