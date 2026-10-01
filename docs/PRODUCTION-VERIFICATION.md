# Produção verificada — 1 de outubro de 2026

Dashboard: https://dashboard.launchcontrol.com.br  
Vault: https://auth.clubeducacao.com.br

## Versões publicadas

| Componente | Commit | Deployment Railway |
| --- | --- | --- |
| Dashboard API | `2273821a30908a6838351172bdded982d742730d` | `54f54ac1-4877-4e39-b14c-36cec410f269` |
| Dashboard frontend | `14ce72f42f00486c13ce027ddb0c163df44831ca` | `4aed8fbf-351e-4733-9df8-6c4561c2fffe` |
| Vault API | `4c4836d415f2e7c6ec00770c5a1a799fc6366e79` | `6511f9a8-a8ef-4b33-a9c4-60fe34b503b7` |
| Vault frontend | `6829440b722045e1bee81e5ceefb6c637e2b5b3a` | `46987508-19f9-4fd3-8a7c-2fb2b050123a` |

Todos os oito serviços do projeto Dashboard no Railway estão em SUCCESS: API, frontend, PostgreSQL e cinco serviços Hub. O serviço isolado dashboard-api-release-check foi excluído após a validação.

As duas migrações PostgreSQL do Dashboard e o bootstrap protegido do Hub foram aplicados. O Hub possui armazenamento persistente e materiais privados. A base Hub foi inicializada sem usuários, vendas ou dados de demonstração; não foi importado histórico do antigo projeto Supabase inacessível. O banco antigo do Dashboard não foi localizado entre os serviços acessíveis e não foi excluído por aproximação; o banco novo autorizado está em uso.

## Evidências

- 69 testes da API e 64 da interface passaram; build, testes de interface com fixtures e verificações responsivas também passaram.
- Login real Vault/PKCE em três perfis: administrador com 26 menus, usuário com 2 e vendedor com 2. Entrada pela raiz e bloqueio de rotas diretas validados. Administrador do Dashboard não ganha administração global do Vault.
- Onze leituras reais da API passaram, incluindo plataformas de venda, reembolsos, metas e ledger. TLS válido, ausência de token e assinatura inválida rejeitadas.
- Dez telas financeiras navegadas no endereço oficial, sem erro JavaScript ou resposta HTTP inesperada. Primeira carga observada: diário 4,1 s; global 10,7 s; mensal 1,3 s; anual 55,4 s. Esses tempos são medições daquela execução, não garantias; dependem das plataformas. O anual fez zero chamadas Asaas durante a consolidação principal.
- Materiais: upload, organização, link assinado, conteúdo baixado e bloqueio de acesso público testados. KPIs: vendedor limitado aos próprios registros e administrador com visão de equipe.
- Vendas manuais, repetição idempotente, atribuição, conciliação sem duplicidade e recuperação de sincronização testadas em registros sintéticos futuros; vendas e auditorias de teste removidas por IDs exatos.
- 35 tabelas do proxy Hub consultadas com sucesso; 33 rotas e recursos retirados retornaram 404 com autenticação.
- Quinze telas comerciais, três abas de metas e todas as abas de Marketing verificadas. A consulta ao investimento do webinar foi corrigida para metric_key/metric_value; nenhum erro de coluna permaneceu.
- Temas claro/escuro e viewport móvel conferidos. Capturas de tela e relatórios sanitizados estão no diretório de evidências local.

## Correções encontradas no teste real

Intervalos TMB preservam datas YYYY-MM-DD sem recuar um dia em São Paulo. Janeiro foi verificado contra dados e logs reais. O extrato Asaas agora percorre páginas além do antigo limite de 5.000 registros, agrega sem duplicar IDs, respeita os headers de limite e não publica totais truncados. Maio, que antes falhava, retornou completo e consistente em 102,6 s.

O caixa Asaas anual é consultado separadamente, com progresso e cancelamento ao sair. Ele não bloqueia os indicadores operacionais. Recebimentos, taxas e líquido não são interpretados como novas vendas ou valor contratado.

## Administração e limitações externas

No Vault: **Usuários → usuário → Acessos e Permissões → Dashboard**. O administrador define perfil e telas autorizadas; a seleção também está disponível na criação.

- Meta Ads: credencial expirada, confirmada anteriormente pelo código 190/subcódigo 463; a API principal continua sinalizando gastos indisponíveis, com valor desconhecido.
- Planilhas de Marketing: conectores ainda sem configuração real, retornando explicitamente MARKETING_CONFIGURATION_PENDING. A interface encerra o carregamento e não apresenta falha de schema.
- Asaas: o banco antigo de checkout foi descartado da integração por autorização. Caixa é conhecido quando consultado; novas vendas e valores contratados permanecem desconhecidos.
- TMB: cancelamento não comprova reembolso; Hotmart não fornece, nesta integração, a data e o caixa exatos da devolução. A interface separa esses eventos e as solicitações.

Os relatórios JSON não contêm tokens, senhas, clientes, valores comerciais nem identificadores de transações reais. As capturas do navegador permanecem em diretório local privado.

## Limpeza concluída

As três contas temporárias do Vault e as três identidades técnicas do Hub foram excluídas por IDs exatos. Acessos, papéis e sessões de teste foram removidos; permissões legítimas e auditoria preservadas. Tokens ainda não expirados passaram a receber HTTP 401 no Vault e Dashboard. Nenhum registro de venda, material, arquivo ou KPI sintético usado na validação permanece.
