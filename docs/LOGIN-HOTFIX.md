# Correção de sessão e cache — 1 de outubro de 2026

O console informado pelo usuário executava `index-BicchL8K.js`, artefato anteriormente servido pelo domínio oficial. Na investigação, a versão atual era `index-D0AHLCWc.js`. O servidor não exigia revalidação de HTML e retornava HTML com status 200 para bundles inexistentes. Isso explica a possibilidade de código antigo, mas não prova sozinho a causa exata de cada 401.

O Vault também tinha contas globais administrativas com associação ao Dashboard e sem perfil específico do aplicativo. A sessão OAuth era válida, mas a API retornava `403 DASHBOARD_ACCESS_REQUIRED`. Esse caso agora exibe uma orientação de configuração de acesso, em vez de apresentar apenas o login. As permissões continuam sendo validadas no servidor; nenhum administrador global ganha permissões de Dashboard implicitamente.

Visitas sem credenciais não consultam endpoints protegidos. Credenciais de renovação existentes são usadas antes de verificar o acesso. Sessão inválida, permissão ausente e indisponibilidade temporária têm mensagens e ações distintas. A renovação e o retorno OAuth continuam passando pelo Vault.

O Caddy revalida HTML de todas as rotas, mantém cache permanente de arquivos com hash e responde 404 sem HTML para bundles removidos. Veja [STATIC-CACHE.md](./STATIC-CACHE.md).

Validação: `npm test`, lint dos arquivos modificados, `npm run build`, `node tests/ui/auth-session-smoke.mjs`, `npm run test:ui` e `node tests/infra/static-cache-smoke.mjs`. Os testes de sessão e os demais testes locais usam credenciais sintéticas somente em contextos isolados com respostas simuladas. O teste de produção usa login real de conta temporária, sem injeção de sessão.
