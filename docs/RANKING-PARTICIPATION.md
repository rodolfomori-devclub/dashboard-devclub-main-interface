# Participação nos rankings

Em **Administração → Participação nos rankings**, um administrador pode buscar
usuários por nome ou time, filtrar participantes/excluídos e alternar a participação.
Cada alteração é salva imediatamente. Não há exclusão de conta: identidade, acesso,
permissões, histórico de vendas e comissões continuam sob seus próprios controles.

## Efeito da configuração

- Pessoas excluídas não entram nos rankings de vendedores, metas/ritmo individuais
  nem na composição e nos resultados por time, incluindo a TV pública.
- Os totais financeiros gerais e por produto continuam contabilizando as vendas
  registradas. Excluir uma pessoa não cancela, apaga nem desatribui suas vendas.
- O planejamento individual já existente permanece como histórico. Uma pessoa
  excluída não pode receber uma nova meta individual até ser reincluída.
- A reinclusão restaura a participação também nos períodos históricos, seguindo
  a regra já utilizada para a composição atual dos times.
- A TV recarrega os dados automaticamente; o cache e a consulta periódica podem
  levar até dois minutos para refletir a alteração.

As alterações são exclusivas de administradores e têm auditoria no servidor. A
revisão por usuário impede que uma aba antiga sobrescreva a escolha mais recente
de outro administrador. O conflito recarrega a lista e exige uma nova ação.

## Contrato e implantação

- `GET /api/ranking-participation`: diretório administrativo, participação e revisão.
- `PUT /api/ranking-participation/:id`: `excludedFromRanking` booleano e
  `expectedRevision` inteiro; retorna o usuário atualizado ou HTTP 409 por conflito.
- As consultas protegidas de perfis e do diretório de metas incluem o indicador
  `excludedFromRanking`, mas não os dados de auditoria.
- A TV pública recebe somente os resultados agregados e estados de disponibilidade;
  ela não recebe a lista de exclusões nem identificadores internos.
- Aplicar `20261001_ranking_participation.sql` antes da API e publicar a API antes
  do frontend. A ausência de override mantém a participação, preservando a exceção
  legada existente até uma alteração explícita do administrador.

Os modelos puros da TV pública são espelhados no backend. Toda alteração deve
manter o manifesto e os testes de paridade conforme `tvModel/README.md` na API.
