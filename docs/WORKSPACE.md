# Dashboard + Hub: configuração e operação

O aplicativo unificado fica em `dashboard-devclub-main-interface`. O código migrado do Hub está em `src/hub`; todos os módulos usam a navegação, os temas e a sessão Vault do Dashboard. A aplicação original em `Dev/Modelo de Hub` foi preservada como origem/histórico; não é uma segunda aplicação necessária para o novo frontend.

## Funcionalidades

- Diário, global, mensal, anual e comparativos compartilham normalização e filtros de vendas. Famílias: MBA, DevClub, IAClub e **Seu segundo salário com IA**. Produtos desconhecidos continuam identificados, sem classificação arbitrária.
- UTMs ausentes ficam como “Não informado”. O valor operacional mantém o critério das integrações existentes. Bruto, líquido e caixa são separados; ausência de informação difere de zero.
- Metas por produto/indicador, supermeta/ultrameta, observações e ritmo por dias corridos ou segunda a sexta (sem calendário de feriados). O dia atual conta como transcorrido. Meses futuros não recebem vendas presumidas.
- Meta geral operacional mensal é sincronizada com a meta mensal antiga. Meta anual continua independente; não há rateio automático entre meses. Metas comerciais do Hub ficam na aba Time comercial.
- Atribuição, conciliação e lançamento manual exigem a permissão `attribution` ou admin. Operações são auditadas e repetição do mesmo envio é idempotente. Um lançamento conciliado fica no histórico e deixa de somar ao financeiro.
- Materiais aceitam links, categorias e arquivos de até 20 MB. Administradores podem cadastrar/editar/excluir; usuários autorizados consultam. Arquivos enviados ficam privados e são abertos com URL temporária.
- Usuários e menus são administrados no Vault, sem um cadastro de contas paralelo no Dashboard.
- Telas TS, tráfego, monitor, leads e vidômetro e suas rotas exclusivas saíram do Dashboard. No Hub migrado não há vendas, agendamentos, avaliações de reuniões, CRM, agenda ou call analysis. Integrações financeiras compartilhadas e históricos não foram apagados.

## Configuração

Copie os campos de `.env.workspace.example` para a configuração do frontend, sem copiar credenciais de servidor. `VITE_API_URL` pode ser absoluto ou `/api` sob proxy de mesma origem. No Vault, use o sistema de slug `dashboard` e cadastre o redirect `/callback` do endereço final.

Prepare a API conforme `dashboard-devclub-main-api/docs/WORKSPACE.md`. As migrações do Dashboard e do Supabase são distintas. O frontend não contém a service key ou JWT secret do Hub. O acesso é negado quando a sessão ou a atribuição do Vault não é válida.

No Vault atualizado, abra Sistemas → Dashboard → Roles/Permissões → Atualizar catálogo de telas. Crie/edite um usuário e escolha Admin do Dashboard ou Usuário com os menus desejados. O papel de administrador global do Vault é independente. A política de autenticação permanece administrada pelo Vault.

## Verificação e carregamento

`npm test` executa testes financeiros, de filtros, metas e conciliação. `npm run build` gera o aplicativo. `npm run test:ui` executa testes de navegação responsiva com dados artificiais e rede externa bloqueada; requer Chromium/Chrome disponível. Esses testes não confirmam credenciais das plataformas ou latência de produção.

As telas são carregadas sob demanda. Bibliotecas de gráficos antigos, editor e exportação não são pré-carregadas na entrada. Consultas simultâneas do mesmo período compartilham requisição, há cache curto por sessão e a mudança de filtros atua em memória. A atualização manual invalida o cache. Histórico comercial pagina os dados para evitar o limite de 1.000 linhas do Supabase.

A identidade visual adapta a referência local `Dev/masia/wt-backoffice-front/src/components/backoffice/pages/revops`, indicada pelo usuário: Plus Jakarta Sans/Outfit, curvas coral/ciano e brilho suave no tema escuro, com versão clara da mesma hierarquia.

Dependência SheetJS instalada na versão oficial distribuída pelo fornecedor, conforme [documentação de instalação](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). Não usa a versão antiga publicada no npm.

## Limites explícitos

Hotmart retorna compras com status de reembolso nesta integração; isso não informa a data exata nem o caixa devolvido. TMB retorna cancelamentos, que não comprovam devolução. Solicitações Typeform/planilha permanecem separadas dos eventos financeiros.

Se uma fonte falhar, a tela sinaliza dados parciais. O sistema não transforma falha em zero nem deduz UTMs. A previsão de meta é linear e não uma garantia de resultado.

Os testes unitários e a suíte de navegação local usam dados simulados. O runner separado `tests/ui/vault-production-smoke.mjs` valida login real pelo Vault, permissões e navegação de três perfis em contextos de navegador isolados. Ele exige contas temporárias em arquivos JSON 0600 fora do repositório, não registra tokens ou dados comerciais e deve ser executado apenas durante a validação de produção autorizada.


## Publicação em produção

O Vault com o catálogo unificado e a infraestrutura isolada do Hub já foram publicados no Railway. O Hub usa cinco serviços: banco, Auth técnico, REST, Storage privado com volume e gateway; o login humano continua exclusivo do Vault. O frontend principal foi publicado e verificado em 1 de outubro de 2026, com a API compatível saudável e as migrações/permissões aplicadas. Versões e limitações estão em [PRODUCTION-VERIFICATION.md](./PRODUCTION-VERIFICATION.md). O código desta release é preservado na branch `codex/unified-dashboard-20260930`; a promoção para `master` deve ser fast-forward, sem reescrever histórico.

O frontend é servido pelo Railway em `https://dashboard.launchcontrol.com.br`. O destino fixo é o projeto `dashboard-launch-control` (`9c3066f8-120f-4a25-9756-10d0e934703a`), ambiente production (`3bb4746f-e0ae-4972-a9d1-7ff947d99792`), serviço frontend (`cd61f257-4826-4cb8-a105-51d40aa6ba7c`). O procedimento anterior de S3/CloudFront foi substituído.

1. Publique a API compatível e confirme que `/api/access` está disponível antes do frontend.
2. No serviço frontend do Railway, confira `VITE_API_URL`, `VITE_VAULT_URL`, `VITE_VAULT_CLIENT_ID`, `VITE_VAULT_REDIRECT_URI` e `VITE_VAULT_HUB_URL`. São valores públicos incorporados pelo Vite durante o build; `.env` local não é enviada.
3. Execute `npm test`, `npm run test:ui` e `npm run deploy:check`. O último comando monta e valida o pacote sem transmitir arquivos.
4. Execute `npm run deploy` somente quando for publicar. O script usa IDs explícitos, acompanha o build no Railway e limpa o pacote temporário. Inclui apenas os arquivos necessários ao build, `src` e `public`; exclui env, dependências locais, testes, fixtures, screenshots e `dist`. O build remoto usa as variáveis do serviço, sem recompilar com o `.env` local.
5. Confirme o novo deployment com `railway service status --project 9c3066f8-120f-4a25-9756-10d0e934703a --environment 3bb4746f-e0ae-4972-a9d1-7ff947d99792 --service cd61f257-4826-4cb8-a105-51d40aa6ba7c` e verifique login e uma rota interna no domínio canônico. Build concluído não substitui essa verificação.

O callback de produção é `https://dashboard.launchcontrol.com.br/callback`. O SDK conduz aliases para a origem do callback configurado antes de gerar PKCE, mantendo caminho e filtros e ignorando parâmetros que tentem alterar essa origem. Isso preserva o estado em `sessionStorage` até o retorno do Vault. Em desenvolvimento, mantenha o callback na mesma origem do servidor local; nesse caso não há redirecionamento de origem.

A API deve usar o issuer publicado no discovery do Vault (`vault-devclub` na configuração verificada), que é distinto da URL HTTP do Vault. O fluxo real de autenticação exige client e redirect registrados, CORS do Vault para o domínio do Dashboard e fallback SPA em `/callback`.
