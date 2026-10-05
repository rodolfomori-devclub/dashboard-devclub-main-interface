# Onboarding comercial

A área reúne as trilhas MBA e DevClub e a biblioteca de consulta do vendedor. O administrador libera cada trilha individualmente em Administração → Usuários e acessos. Concluir uma trilha não remove o acesso aos materiais.

## Direção de interface

Preservar a identidade do Dashboard: Plus Jakarta Sans para leitura, Outfit nos títulos; superfície branca #ffffff, fundo #f4f6f8, texto #172b37, apoio #526472, destaque #087f8c e seleção #3c5bdc. O tema escuro usa os tokens existentes.

A hierarquia central é uma trilha com etapas e atividades reais, alinhada à esquerda. Navegação de etapas à esquerda, lista de estudo à direita, próxima atividade no topo; biblioteca pesquisável em aba própria. A numeração indica uma sequência de estudo, sem transformar cada conteúdo em um cartão decorativo. No celular, as etapas passam para uma lista horizontal. A leitura permanece confortável e os controles funcionam por teclado.

Revisão do plano: o pacote original é uma página longa com referências repetidas. A melhoria será separar estudo, consulta diária e pendências comerciais, com progresso por conta. Preservar os materiais, a autoria e as condições fornecidas; não inventar preços, prazos ou promessas. O deck MBA divergente permanece sinalizado para revisão.

## Conteúdo e segurança

Fontes de 05/10/2026 nas pastas locais Onboarding Time MBA e Onboarding Time DevClub. Catálogos e arquivos ficam no backend privado e são autorizados por trilha a cada requisição. Nenhum material comercial entra em public/ ou nos bundles do frontend.

As permissões `onboarding-mba` e `onboarding-devclub` são administradas no Vault pela interface já existente do Dashboard. Administradores têm ambas. O progresso é salvo por conta, trilha e atividade; não é uma certificação automática de liberação comercial.

## Operação

- Menu Onboarding → Onboarding MBA ou Onboarding DevClub.
- Administração → Usuários e acessos → Editar acessos → Onboarding: marcar uma ou ambas as trilhas. O padrão de vendedor não concede conteúdo de outro time automaticamente.
- Biblioteca do vendedor: busca por texto, categoria e uso interno/material para lead. A tela Materiais também oferece atalhos para as bibliotecas autorizadas.
- A conclusão é uma marca de estudo por pessoa. A liberação para atendimento continua com a liderança.
- Materiais interativos abrem isolados da aplicação. O gerador original não grava anotações no servidor: use os botões de backup/importação da própria ferramenta. A trilha nova salva o progresso na conta.
- As notas de revisão mantêm explícitos os pontos comerciais pendentes. Nenhum preço, garantia, bolsa ou calendário foi aprovado pela importação.

## Integração e publicação

Esta implementação acompanha os repositórios Dashboard API e Vault API. Aplicar a migration `20261005_onboarding_progress.sql` no PostgreSQL do Dashboard, publicar API e interface compatíveis e então o catálogo Vault com as duas permissões. Não conceder acessos em massa automaticamente.

Os 37 arquivos do conteúdo original ficam somente no backend privado, incluindo PDFs, vídeo, HTMLs e roteiros. Os catálogos somam 64 atividades e 70 recursos (arquivos e referências externas), com 23 pontos editoriais de atenção. Conteúdo-base preservado byte a byte; as melhorias de organização e descrição ficam no catálogo.

Validação local: `npm test`, `npm run build`, lint dos arquivos alterados e `npm run deploy:check`. Os testes do onboarding exercitam React/DOM, persistência após remontagem, erro de gravação, biblioteca após conclusão, acesso por time, navegação privada e abertura segura dos materiais. Os testes da API cobrem PostgreSQL temporário, isolamento por conta/trilha, autorização dos arquivos e a integridade dos originais. Testes locais não comprovam uma publicação em produção.
