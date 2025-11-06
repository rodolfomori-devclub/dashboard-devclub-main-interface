# Firebase Admin Script

Este script deleta todos os usuários existentes no Firebase e cria um novo usuário administrador.

## Pré-requisitos

Você precisa obter uma **Service Account Key** do Firebase Console.

### Como obter a Service Account Key:

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Selecione o projeto: **dashboard-devclub**
3. Clique no ícone de engrenagem (⚙️) e selecione **Configurações do projeto**
4. Vá para a aba **Contas de serviço** (Service Accounts)
5. Clique no botão **Gerar nova chave privada** (Generate new private key)
6. Clique em **Gerar chave** (Generate key)
7. Um arquivo JSON será baixado automaticamente
8. Renomeie este arquivo para **serviceAccountKey.json**
9. Mova o arquivo para a raiz do projeto:
   ```
   dashboard-devclub-main-interface/serviceAccountKey.json
   ```

## Como executar

Depois de colocar o arquivo `serviceAccountKey.json` na raiz do projeto:

```bash
npm run create-admin
```

## O que o script faz

1. ✅ Verifica se a Service Account Key existe
2. 🗑️ Deleta **TODOS** os usuários do Firebase Authentication
3. 🗑️ Deleta **TODOS** os documentos de usuários do Firestore
4. 👤 Cria um novo usuário administrador com:
   - **Email**: admin@email.com
   - **Senha**: R453FJ4394&*#$CH@#*
   - **Permissões**: Admin completo (acesso a todas as páginas)
5. 💾 Salva as credenciais em um arquivo: `admin-credentials.txt`

## Segurança

⚠️ **IMPORTANTE**:
- O arquivo `serviceAccountKey.json` contém credenciais sensíveis
- O arquivo `admin-credentials.txt` contém o login e senha do admin
- Ambos os arquivos estão no `.gitignore` e **NÃO DEVEM** ser commitados
- Mantenha estes arquivos seguros e não os compartilhe

## Avisos

🚨 **ATENÇÃO**: Este script é **DESTRUTIVO** e irá:
- Deletar permanentemente todos os usuários existentes
- Não há como desfazer esta ação
- Aguarda 5 segundos antes de executar (pressione Ctrl+C para cancelar)

## Resultado esperado

Após a execução bem-sucedida, você verá:

```
✅ OPERATION COMPLETED SUCCESSFULLY!

Admin Login: admin@email.com
Admin Password: R453FJ4394&*#$CH@#*

Credentials have been saved to: admin-credentials.txt
```

## Troubleshooting

### Erro: "Service Account Key not found"
- Verifique se o arquivo `serviceAccountKey.json` está na raiz do projeto
- Verifique se o nome do arquivo está correto (case-sensitive)

### Erro ao inicializar Firebase Admin
- Verifique se o arquivo JSON está válido
- Verifique se você baixou a chave do projeto correto (dashboard-devclub)

### Erro de permissões
- Certifique-se de que a Service Account tem permissões de admin no Firebase
- Verifique se o projeto ID está correto
