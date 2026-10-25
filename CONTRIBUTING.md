# Contribuindo com o devops-repo-creator

Ao participar, você concorda em seguir o [Código de Conduta](CODE_OF_CONDUCT.md). Para reportar um problema de segurança, **não** abra uma issue — siga o [SECURITY.md](SECURITY.md).

## Idioma

Documentação, issues, Pull Requests e mensagens ao usuário em português do Brasil.

## Configurando o ambiente

1. Instale Node.js 20 ou superior (o projeto usa `"type": "module"`).
2. Clone e instale:
   ```bash
   git clone https://github.com/EcoCiente-Instituto-J-F/devops-repo-creator.git\n   cd devops-repo-creator\n   npm install\n   ```\n3. Copie `.env.example` para `.env` (ignorado pelo Git) e preencha com os dados de um GitHub App de **teste**. O passo a passo de criação do App e do deploy está no README.

## Testando sua mudança

O projeto ainda não tem testes automatizados nem CI. Teste manualmente o fluxo afetado (login com GitHub, validação de membro da organização, criação do repositório) usando uma organização e um GitHub App de teste, nunca os de produção.

Mudanças na criação de repositórios devem preservar o padrão descrito no README (template, README, licença MIT, ruleset de proteção da `main`).

## Regras do projeto

- Nenhum segredo (chaves, tokens, senhas) no repositório.
- Nenhum dado pessoal real em testes, fixtures ou exemplos.
- Nenhuma dependência nova sem discussão prévia.
- Nunca coloque no frontend (`docs/`) Personal Access Token, Client Secret, Private Key ou Installation Token: esses valores ficam só no backend (`api/`, `lib/`).
- Variáveis novas entram no `.env.example` e no README; a configuração é lida em `lib/config.js`.
- Mantenha a validação de que o usuário é membro ativo da organização no login (`api/auth/callback.js`) e a exigência de sessão válida em `api/repositories/create.js`.
- O CORS aceita somente a origem de `FRONTEND_URL` (`lib/cors.js`).

## Pull requests

1. Crie uma branch a partir da `main` (ex.: `feat/nome-da-mudanca`).
2. Faça commits focados com prefixos `feat:`, `fix:`, `chore:`, `docs:`, `test:` ou `refactor:`.
3. Abra a PR para a `main`. Descreva o que mudou e por quê.
4. O CI precisa passar (quando houver) e um mantenedor revisa antes do merge.

## Reportando bugs e propondo funcionalidades

Abra uma issue com o comportamento esperado, o observado, os passos para reproduzir e a versão. Use dados fictícios. Para vulnerabilidades, siga o [SECURITY.md](SECURITY.md).
