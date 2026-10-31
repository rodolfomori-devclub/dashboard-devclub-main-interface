# Incidente de acesso ao Dashboard — 1 de outubro de 2026

## Diagnóstico

O usuário informou 401 de endpoints financeiros e mensagem para entrar pelo Vault, apesar de ser administrador. O bundle citado (`index-BicchL8K.js`) é uma versão anteriormente servida pelo domínio oficial, diferente da versão corrente no início da investigação (`index-D0AHLCWc.js`). HTML não tinha Cache-Control, e o servidor devolvia HTML com status 200 para bundles inexistentes. A relação exata entre cada 401 e o token enviado não pôde ser comprovada sem os códigos de resposta daquela sessão.

A auditoria de produção confirmou também OAuth e userinfo válidos para uma conta global administrativa com associação ao Dashboard, mas sem papéis específicos desse aplicativo: a API recusava o acesso com 403 DASHBOARD_ACCESS_REQUIRED. Os acessos legítimos não haviam sido removidos pela limpeza anterior. A identidade da conta do solicitante foi posteriormente confirmada pela sessão aberta do Vault e correlacionada aos mesmos eventos OAuth da auditoria.

## Correção publicada

Commit frontend: `bbc049565e088fbd42f9401449b3f996dfc1b610`.
Deploy Railway: `09a8f079-4b0e-4f9a-bd3f-c830d0f33e0c`, SUCCESS.
Bundle: `/assets/index-V76brH1S.js`.
Endereço: https://dashboard.launchcontrol.com.br.

Visitas anônimas não chamam API protegida; refresh existente é usado antes da consulta de acesso. Falta de perfil, sessão inválida e indisponibilidade do Vault têm diagnósticos próprios. O botão de tentar novamente revalida os grants atuais. O acesso continua sendo decidido pela API, sem bypass de administrador global.

O servidor exige revalidação do HTML em todas as rotas, usa cache permanente apenas para assets com hash e retorna 404 sem HTML para assets removidos. Backend e configuração OAuth de produção não foram alterados.

## Verificação

- 78 testes unitários do frontend; lint dos arquivos modificados e build passaram.
- 7 cenários de sessão em navegador: anônimo, permissão403 e recuperação, refresh401, refresh inicial, credencial inválida, sessão inválida e indisponibilidade503.
- 43 verificações de integração, diário/pace e caixa Asaas nas telas existentes passaram; rede externa bloqueada nos testes simulados.
- Caddy 2.11.4 validado em contêiner isolado. Cache/ETag, 304 e assets ausentes também validados no domínio canônico e no alias reais.
- Reprodução real com conta temporária global ADMIN: /access403 sem papel do Dashboard; grant normal pela API e /access200 com o mesmo token.
- Login real em navegador de produção passou: 26 permissões, Administração, Metas e Diário; provedores HTTP 200, zero erros de execução e zero 401/403.
- Conta QA removida; zero acessos, grants, sessões e códigos remanescentes. Token ainda não expirado recusado com 401 por userinfo e Dashboard, e refresh também recusado com 401. Quatro arquivos privados de credenciais removidos. Hash de usuários/acessos/grants/catálogo legítimos permaneceu idêntico (15 usuários, 71 acessos, 34 grants e 31 itens de catálogo).

## Conta real verificada

A conta do solicitante foi identificada na sessão aberta do Vault, sem copiar credenciais. Consulta read-only confirmou que ela corresponde aos eventos OAuth do incidente. Quando o procedimento idempotente foi executado, o papel admin do Dashboard já estava presente; por isso o script não alterou dados. O grant foi criado às 11:38:04.259Z, antes da checagem de 11:38:28.273Z; a auditoria corresponde ao fluxo normal do Vault e não tem marcador do script. Preservação dos demais usuários/sistemas validada pela transação.

A verificação na sessão real do navegador confirmou o perfil Administrador, menus disponíveis e Visão global carregada com dados. A mensagem de acesso não configurado desapareceu. Não foi necessário criar nova conta QA ou publicar outra versão.

## Evidências

- [Cache e bundle em produção](verification/auth-frontend-production.json)
- [Auditoria de acesso no Vault](verification/auth-incident-vault-readonly.json)
- [Reprodução com conta QA](verification/auth-qa-scope-reproduction.json)
- [Navegador real em produção](verification/auth-qa-browser.json)
- [Limpeza e revogação QA](verification/auth-qa-cleanup.json)
- [Perfil da conta real confirmado](verification/auth-owner-grant-check.json)
- [Sessão real no navegador confirmada](verification/auth-owner-browser-check.json)
