# EcoCiente Repository Creator

Interface web para criar repositórios padronizados na organização `EcoCiente-Instituto-J-F`.

## Arquitetura

- `docs/`: frontend estático publicado no GitHub Pages.
- `api/`: backend serverless publicado na Vercel.
- `lib/`: autenticação, sessão e integração com a API REST do GitHub.
- GitHub App: autentica usuários da organização e executa a criação/configuração dos repositórios sem expor tokens no navegador.

> O frontend não contém token, PAT, Client Secret ou Private Key. Esses valores ficam somente no backend.

## O que é criado

Todo repositório criado pela interface usa:

- owner: `EcoCiente-Instituto-J-F`;
- template: `EcoCiente-Instituto-J-F/ecociente-repo-template`;
- branch padrão herdada do template (o template deve usar `main`);
- README garantido;
- licença MIT garantida;
- `.gitignore` raiz removido, caso exista no template;
- Merge, Squash e Rebase habilitados.

### Ruleset para repositórios públicos

Nome: `Proteção Main`

Target:

- branch;
- include: `refs/heads/main`.

Regras:

- Restrict deletions;
- Block force pushes;
- Require a pull request before merging;
- Required approvals: 1;
- Dismiss stale pull request approvals when new commits are pushed;
- Require conversation resolution before merging;
- Allowed merge methods: Merge, Squash e Rebase.

### Repositórios privados

No GitHub Free para organizações, rulesets de branch não estão disponíveis para repositórios privados. O backend cria o repositório privado normalmente e pula a criação da ruleset.

---

# 1. Preparar o template

Confirme que `EcoCiente-Instituto-J-F/ecociente-repo-template`:

1. está configurado como **Template repository**;
2. possui a branch padrão `main`;
3. contém os arquivos do PR Bot que todos os novos repositórios devem receber.

O backend garante README e MIT License e remove um `.gitignore` da raiz, então esses arquivos não precisam ser controlados manualmente no template.

---

# 2. Criar o repositório deste sistema

Crie um repositório público, por exemplo:

`ecociente-repo-creator`

Copie todo este projeto para ele e faça push na branch `main`.

---

# 3. Criar o GitHub App

Crie o GitHub App dentro da organização `EcoCiente-Instituto-J-F`.

Sugestão de nome:

`EcoCiente Repository Creator`

Configuração:

- Homepage URL: URL do repositório ou, depois, URL do GitHub Pages;
- Callback URL: pode ser temporária no primeiro cadastro; depois deve ser alterada para:
  - `https://SEU-BACKEND.vercel.app/api/auth/callback`
- Webhook: desativado.

## Permissões do GitHub App

Repository permissions:

- **Administration: Read and write**
- **Contents: Read and write**

Organization permissions:

- **Members: Read-only**

Em **Where can this GitHub App be installed?**, deixe restrito à conta/organização dona do App se a interface oferecer essa opção.

Depois de criar o GitHub App:

1. copie o **App ID**;
2. copie o **Client ID**;
3. gere um **Client Secret**;
4. gere uma **Private Key** (`.pem`);
5. instale o App na organização EcoCiente;
6. dê acesso a **All repositories** para simplificar a administração.

Nunca commite Client Secret ou Private Key.

---

# 4. Publicar o backend na Vercel

Importe este mesmo repositório na Vercel ou faça deploy pelo CLI.

A Vercel utilizará automaticamente os arquivos dentro de `/api` como funções Node.js.

Configure as variáveis de ambiente do arquivo `.env.example`:

```env
GITHUB_APP_ID=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_INSTALLATION_ID=
GITHUB_ORG=EcoCiente-Instituto-J-F
GITHUB_TEMPLATE_OWNER=EcoCiente-Instituto-J-F
GITHUB_TEMPLATE_REPO=ecociente-repo-template
FRONTEND_URL=https://ecociente-instituto-j-f.github.io/ecociente-repo-creator
BACKEND_URL=https://SEU-BACKEND.vercel.app
SESSION_SECRET=...
```

`GITHUB_INSTALLATION_ID` é opcional. Se ficar vazio, o backend tenta descobrir automaticamente a instalação do App na organização.

Para gerar `SESSION_SECRET`, use um valor aleatório longo. Exemplo:

```bash
openssl rand -hex 32
```

Depois de saber a URL definitiva da Vercel:

1. atualize `BACKEND_URL` na Vercel;
2. abra as configurações do GitHub App;
3. atualize **Callback URL** para:
   `https://SEU-BACKEND.vercel.app/api/auth/callback`;
4. faça um novo deploy se necessário.

---

# 5. Configurar o frontend

Abra:

`docs/config.js`

Troque:

```js
API_BASE_URL: "https://SEU-BACKEND.vercel.app"
```

pela URL real do backend.

O `ORGANIZATION` já está configurado como `EcoCiente-Instituto-J-F`.

---

# 6. Publicar o frontend no GitHub Pages

No repositório `ecociente-repo-creator`:

1. abra **Settings**;
2. no menu lateral, abra **Pages**;
3. em **Build and deployment** selecione **Deploy from a branch**;
4. branch: `main`;
5. folder: `/docs`;
6. clique em **Save**.

A URL será parecida com:

`https://ecociente-instituto-j-f.github.io/ecociente-repo-creator/`

Confirme que esse endereço é exatamente o mesmo configurado em `FRONTEND_URL` no backend.

---

# 7. Fluxo do usuário

1. abre o GitHub Pages;
2. clica em **Entrar com GitHub**;
3. o backend valida se a conta é membro ativo da organização;
4. preenche Nome, Descrição e Visibilidade;
5. revisa a tela de confirmação;
6. confirma;
7. o backend cria o repositório a partir do template;
8. garante README, MIT License e ausência de `.gitignore` raiz;
9. habilita Merge, Squash e Rebase;
10. se for público, cria a ruleset `Proteção Main`;
11. devolve o link do repositório criado.

---

# Segurança

Não coloque no frontend ou no GitHub Pages:

- Personal Access Token;
- Client Secret;
- Private Key do GitHub App;
- Installation Token;
- qualquer secret administrativo da organização.

O navegador recebe somente uma sessão curta assinada pelo backend. A sessão não contém a Private Key nem um token administrativo do GitHub.
