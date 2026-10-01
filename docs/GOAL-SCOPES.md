# Metas mensais por escopo

A configuração e o ritmo mensal usam o mesmo cadastro `dashboard_goal_plans`.

- **Geral**: toda a operação.
- **Time**: vendas atribuídas às pessoas que pertencem atualmente ao time.
- **Produto**: família MBA, DevClub, IAClub, Seu segundo salário com IA ou Outros.
- **Indivíduo**: vendas atribuídas à pessoa selecionada.

Os escopos são independentes: somar geral, produtos, times e indivíduos duplicaria o mesmo negócio. Cada indicador tem meta, supermeta, ultrameta, dias corridos/úteis e observações próprios. Metas operacionais, líquidas e de quantidade anteriores permanecem disponíveis, sem conversão automática para bruto ou caixa.

## Bruto e cash collected

**Bruto** é o valor total da venda antes das taxas, na data da venda. Nunca usa líquido/valor operacional como substituto de um bruto desconhecido.

**Cash collected** é o recebimento confirmado na data de entrada, antes das taxas. Inclui parcelas de contratos anteriores. A consulta Asaas fornece lançamentos efetivos por dia; estes valores não comprovam novas vendas nem atribuição por produto ou vendedor. Lançamentos sem data ficam no total parcial, fora da curva diária. Vendas manuais usam o caixa e a data declarados no lançamento. Manuais declaradas Asaas são excluídas do caixa em todos os escopos enquanto não houver vínculo por recebimento, evitando duplicação com o extrato; bruto/líquido/quantidade permanecem intactos. A exclusão e a cobertura parcial são informadas na tela.

O contrato atual Boletex fornece recebimentos acumulados dos contratos criados no período, sem datas de cada entrada. Esse valor não é usado como caixa mensal. Guru, Hotmart e TMB também não oferecem um extrato de recebimentos no fluxo atual. A interface informa cobertura parcial, fontes sem extrato e valores sem atribuição, em vez de tratar essas lacunas como zero ou distribuir valores proporcionalmente.

Metas de time usam a composição **atual**, inclusive em consultas históricas; alterações de equipe afetam a leitura. Não existe inferência por nome ou UTM livre. Atribuição explícita e vendas manuais passam pelo ledger auditado, com a conciliação evitando contagem duplicada.

## Acesso e compatibilidade

A administração continua no Vault. Leitores com acesso à tela consultam metas e opções; somente administradores do Dashboard salvam metas. O catálogo retorna apenas ID, nome, status e vínculo de time. Perfis comerciais aparecem após primeiro acesso ao módulo comercial; contas humanas continuam geridas no Vault.

A migração mantém os IDs, valores e auditoria anteriores: `product=all` torna-se `overall`; outras famílias tornam-se `product`. Apenas a meta geral operacional sincroniza o consumidor legado mensal. Metas de time/pessoa, bruto e caixa não sobrescrevem os totais legados.

## Verificação da implementação — 1º de outubro de 2026

- `npm test`: 78 testes aprovados, incluindo separação de bruto/caixa nos quatro escopos, compatibilidade de metas anteriores e prevenção de caixa manual Asaas duplicado.
- Build Vite concluído; o aviso existente de tamanho do módulo de PDF permanece.
- ESLint nos 10 arquivos JavaScript/JSX alterados: zero erros e zero avisos.
- `npm run lint` completo **não passa**: 235 erros e 3 avisos em 27 arquivos anteriores. Todos esses arquivos têm conteúdo idêntico à base `14ce72f42f00486c13ce027ddb0c163df44831ca`, confirmado por comparação de bytes e SHA-256. O [registro da comparação](goal-scopes-lint-baseline.json) contém nomes, quantidades e hashes, sem credenciais.
- Smoke de interface: oito gravações com payload exato (bruto/caixa × quatro escopos), validação de faixas, indicador operacional anterior, páginas legadas e leitura sem edição. O fluxo integrado passou em 43 verificações; as telas de configuração foram conferidas em desktop e 360 px nos temas claro e escuro.

Os testes de interface usam dados sintéticos e bloqueiam integrações externas. Os artefatos visuais locais não são versionados.
