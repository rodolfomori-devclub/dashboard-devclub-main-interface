# Metas por escopo — produção, 1 de outubro de 2026

O Dashboard agora configura metas mensais gerais, por time, por família de produto e por indivíduo. Bruto e cash collected possuem metas, supermetas, ultrametas e cálculo de ritmo independentes. As metas anteriores foram preservadas.

## Versões publicadas

- API: commit `f385b09b0813ab9dd858c1796b2996e18473f57f`, Railway `d2249c34-251e-4a39-9bbb-f9e22f2ee7cb`, status SUCCESS, health 200.
- Frontend: commit `de360d578e49c5a6c5d8c01b766027466fa39f84`, Railway `60e67113-338c-446b-8ce9-4cfe411b0464`, status SUCCESS.
- Domínio oficial: https://dashboard.launchcontrol.com.br, HTTP 200, `/assets/index-D0AHLCWc.js`; SHA-256 `cf98ddac834cca354a5bd0da6466c0c761d06661affbb83880c1d3ae49c4da83`.
- Migrações `20261001_goal_scopes.sql` e `20261001_goal_scopes_finalize.sql` aplicadas em sequência, com backup privado e comparação integral dos dados anteriores. A primeira preservou as gravações da API antiga durante a publicação; a segunda liberou os quatro escopos.
- Nenhuma alteração adicional foi necessária no Vault: as permissões existentes de Metas/Ritmo e administrador continuam vigentes.

## Evidência

- 81 testes da API e 78 testes do frontend aprovados, sem testes ignorados; migrações verificadas em PostgreSQL isolado real.
- Interface local: 43 verificações integradas, oito salvamentos exatos, quatro escopos, validação das faixas, preservação do indicador operacional e do legado financeiro/comercial; desktop e 360 px, claro e escuro, sem overflow ou erro de execução.
- Build aprovado e lint dos arquivos alterados limpo. O lint completo tem 235 erros e 3 avisos preexistentes em 27 arquivos com hashes idênticos à versão publicada anterior; a comparação está em `frontend-source/docs/goal-scopes-lint-baseline.json`.
- API real: 39 requisições autenticadas, oito criações e oito atualizações independentes; usuário leitor recebeu 403 nas três operações de escrita/gestão testadas. IDs e auditoria preservados; metas operacionais não foram alteradas por bruto ou caixa. Catálogo sem e-mail/roles, renomeação de time, histórico de nomes, composição de time e idempotência da venda manual verificados.
- Asaas real em 01/10: HTTP 200 em 1,104 s, recebimentos por data e contagem fecharam com o extrato; líquido mais taxas fechou com bruto. Contratos permanecem explicitamente desconhecidos.

Navegação real no frontend publicado aprovada com administrador e leitor: 16 verificações de Metas e 16 de Ritmo, sem erros de execução nem HTTP inesperado. As consultas futuras não chamaram provedores. Uma navegação do administrador no pace do mês atual recebeu os campos reais de recebimentos e exibiu bruto, caixa e cobertura parcial corretamente. Evidência: `verification/goal-scopes-browser.json`.

Limpeza concluída nos três bancos: removidas as oito metas, auditorias e venda manual sintéticas no Dashboard; removidos o espelho da venda, o time e os dois perfis técnicos no Hub; removidas as duas contas temporárias, acessos, grants, tokens de renovação e códigos OAuth no Vault. Os dados legítimos permaneceram idênticos nas comparações. Tokens de acesso ainda não expirados das contas removidas receberam 401 no Vault e no Dashboard. Os seis arquivos privados de conta, credenciais e sessão foram removidos. Evidência: `verification/goal-scopes-cleanup.json`.

## Critérios financeiros

Bruto usa valor total da venda antes das taxas, na data da venda. Cash collected usa recebimentos confirmados antes das taxas, na data de entrada, inclusive parcelas de contratos anteriores. Caixa não é inferido do líquido ou do valor de contrato.

O extrato Asaas não fornece vínculo de produto/vendedor no fluxo atual. Esses recebimentos entram no geral e ficam sinalizados como não atribuídos nos recortes. Guru, Hotmart, TMB e Boletex não fornecem extrato por data de recebimento nesse fluxo, portanto o pace de caixa é parcial; o acumulado vitalício Boletex não é apresentado como caixa mensal. Lançamentos manuais usam data/caixa declarados; manuais identificadas como Asaas não são somadas ao caixa sem vínculo de recebimento, prevenindo duplicação do extrato.

Time usa composição atual, inclusive em períodos históricos, informada na tela. Escopos são independentes e não devem ser somados. Nenhuma meta foi convertida automaticamente entre operacional, bruto e caixa.
