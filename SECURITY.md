# Política de Segurança

O devops-repo-creator cria repositórios na organização EcoCiente usando um GitHub App com permissões administrativas, autentica usuários pelo OAuth do GitHub e mantém uma sessão assinada (JWT); seus segredos (Client Secret, Private Key do App e `SESSION_SECRET`) ficam apenas no backend.

## Versões suportadas

| Versão | Suporte |
| --- | --- |
| `main` (mais recente) | Sim |
| Demais branches | Não |

## Reportando uma vulnerabilidade

**Não abra issue, Pull Request ou discussão pública** para relatar vulnerabilidades.

Use o relato privado do GitHub: <https://github.com/EcoCiente-Instituto-J-F/devops-repo-creator/security/advisories/new> (Security → Advisories → Report a vulnerability).

> Mantenedores: ative *Private vulnerability reporting* em Settings → Code security.

Inclua no relato:

- o impacto da falha;
- os passos para reproduzir, usando **dados fictícios**;
- o commit testado e a configuração;
- se possível, uma ideia de correção.

Depois do relato: confirmaremos o recebimento, corrigiremos de forma privada e publicaremos um advisory com crédito a quem reportou, se desejado. Pedimos um prazo razoável para a correção antes de qualquer divulgação pública.

## Escopo

**Dentro do escopo**

- Criar repositórios sem ser membro ativo da organização ou burlar a validação feita no login
- Falsificação, roubo ou reuso indevido da sessão (`SESSION_SECRET`) ou do `state` do OAuth
- Vazamento de Client Secret, Private Key, Installation Token ou `SESSION_SECRET` (frontend, logs, respostas, repositório)
- Falhas de CORS que permitam outra origem chamar a API
- Injeção em campos como nome e descrição do repositório (por exemplo, para atingir a API do GitHub)
- Segredos commitados

**Fora do escopo**

- Bugs sem impacto de segurança
- Falhas em serviços de terceiros (GitHub, Vercel, GitHub Pages)
- Valores de exemplo do `.env.example`
- Negação de serviço no próprio deploy

## Como o sistema protege os dados

| Camada | Onde | O que faz |
| --- | --- | --- |
| Segredos | `lib/config.js`, `.gitignore` | Segredos só em variáveis de ambiente do backend; `.env` não é versionado |
| OAuth | `api/auth/start.js`, `api/auth/callback.js`, `lib/session.js` | `state` assinado, válido por 10 minutos |
| Sessão | `lib/session.js` | JWT assinado com `SESSION_SECRET`, expira em 7 dias; o navegador não recebe token administrativo do GitHub |
| Autorização | `api/auth/callback.js`, `api/auth/me.js`, `api/repositories/create.js` | O login só é concluído para membro ativo da organização; `me.js` e `create.js` exigem sessão válida (401 sem ela) |
| CORS | `lib/cors.js` | Libera somente a origem configurada em `FRONTEND_URL` |

## Checklist de deploy

- Configurar `GITHUB_CLIENT_SECRET`, `GITHUB_PRIVATE_KEY` e `SESSION_SECRET` (valor longo e aleatório) apenas nas variáveis de ambiente da Vercel.
- Restringir o GitHub App à organização e conceder somente as permissões necessárias (Administration, Contents e Members).
- Manter `FRONTEND_URL` exatamente igual à URL do GitHub Pages e `BACKEND_URL` à URL da Vercel.
- Nunca colocar Personal Access Token, Client Secret ou Private Key em `docs/`.
