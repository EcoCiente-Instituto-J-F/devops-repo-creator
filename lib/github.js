import jwt from "jsonwebtoken";
import { getConfig } from "./config.js";

const API_VERSION = "2026-03-10";
const GITHUB_API = "https://api.github.com";
const INSTALLATION_TOKEN_REFRESH_MARGIN_MS = 60_000;

let cachedInstallationToken = "";
let cachedInstallationTokenExpiresAt = 0;

export class GitHubApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.details = details;
  }
}

function githubHeaders(token, extra = {}) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "EcoCiente-Repository-Creator",
    ...extra
  };
}

export async function githubRequest(
  path,
  { method = "GET", token, body } = {}
) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: githubHeaders(
      token,
      body ? { "Content-Type": "application/json" } : {}
    ),
    body: body ? JSON.stringify(body) : undefined
  });

  const raw = await response.text();

  let data = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    const githubMessage =
      typeof data === "object" && data?.message
        ? data.message
        : "Erro na API do GitHub";

    throw new GitHubApiError(
      githubMessage,
      response.status,
      data
    );
  }

  return data;
}

export function createAppJwt() {
  const {
    githubAppId,
    githubPrivateKey
  } = getConfig();

  const now = Math.floor(
    Date.now() / 1000
  );

  return jwt.sign(
    {
      iat: now - 60,
      exp: now + 9 * 60,
      iss: githubAppId
    },
    githubPrivateKey,
    {
      algorithm: "RS256"
    }
  );
}

async function discoverInstallationId(
  appJwt
) {
  const {
    githubOrg,
    installationId
  } = getConfig();

  if (installationId) {
    return installationId;
  }

  const installation =
    await githubRequest(
      `/orgs/${encodeURIComponent(
        githubOrg
      )}/installation`,
      {
        token: appJwt
      }
    );

  return installation.id;
}

export async function getInstallationToken() {
  const now = Date.now();

  if (
    cachedInstallationToken &&
    cachedInstallationTokenExpiresAt -
      INSTALLATION_TOKEN_REFRESH_MARGIN_MS >
      now
  ) {
    return cachedInstallationToken;
  }

  const appJwt =
    createAppJwt();

  const installationId =
    await discoverInstallationId(
      appJwt
    );

  const data =
    await githubRequest(
      `/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        token: appJwt,
        body: {}
      }
    );

  cachedInstallationToken =
    data.token;

  cachedInstallationTokenExpiresAt =
    data.expires_at
      ? new Date(
          data.expires_at
        ).getTime()
      : now + 50 * 60 * 1000;

  return cachedInstallationToken;
}

export async function exchangeOAuthCode(
  code
) {
  const {
    githubClientId,
    githubClientSecret,
    backendUrl
  } = getConfig();

  const response =
    await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/json",

          "User-Agent":
            "EcoCiente-Repository-Creator"
        },

        body: JSON.stringify({
          client_id:
            githubClientId,

          client_secret:
            githubClientSecret,

          code,

          redirect_uri:
            `${backendUrl}/api/auth/callback`
        })
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    data.error ||
    !data.access_token
  ) {
    throw new Error(
      data.error_description ||
        data.error ||
        "Não foi possível autenticar com o GitHub."
    );
  }

  return data.access_token;
}

export async function getAuthenticatedUser(
  userToken
) {
  return githubRequest(
    "/user",
    {
      token:
        userToken
    }
  );
}

export async function getAuthenticatedUserMembership(
  userToken
) {
  const {
    githubOrg
  } = getConfig();

  return githubRequest(
    `/user/memberships/orgs/${encodeURIComponent(
      githubOrg
    )}`,
    {
      token:
        userToken
    }
  );
}

export async function verifyActiveOrganizationMember(
  installationToken,
  username
) {
  const {
    githubOrg
  } = getConfig();

  const membership =
    await githubRequest(
      `/orgs/${encodeURIComponent(
        githubOrg
      )}/memberships/${encodeURIComponent(
        username
      )}`,
      {
        token:
          installationToken
      }
    );

  return (
    membership?.state ===
    "active"
  );
}

export async function createRepositoryFromTemplate(
  installationToken,
  {
    name,
    description,
    isPrivate
  }
) {
  const {
    githubOrg,
    templateOwner,
    templateRepo
  } = getConfig();

  return githubRequest(
    `/repos/${encodeURIComponent(
      templateOwner
    )}/${encodeURIComponent(
      templateRepo
    )}/generate`,
    {
      method:
        "POST",

      token:
        installationToken,

      body: {
        owner:
          githubOrg,

        name,

        description,

        include_all_branches:
          false,

        private:
          isPrivate
      }
    }
  );
}

export async function createMainProtectionRuleset(
  installationToken,
  repoName
) {
  const {
    githubOrg
  } = getConfig();

  return githubRequest(
    `/repos/${encodeURIComponent(
      githubOrg
    )}/${encodeURIComponent(
      repoName
    )}/rulesets`,
    {
      method:
        "POST",

      token:
        installationToken,

      body: {
        name:
          "Proteção Main",

        target:
          "branch",

        enforcement:
          "active",

        conditions: {
          ref_name: {
            include: [
              "refs/heads/main"
            ],

            exclude: []
          }
        },

        rules: [
          {
            type:
              "deletion"
          },

          {
            type:
              "non_fast_forward"
          },

          {
            type:
              "pull_request",

            parameters: {
              allowed_merge_methods: [
                "merge",
                "squash",
                "rebase"
              ],

              dismiss_stale_reviews_on_push:
                true,

              require_code_owner_review:
                false,

              require_last_push_approval:
                false,

              required_approving_review_count:
                1,

              required_review_thread_resolution:
                true
            }
          }
        ]
      }
    }
  );
}


/*
 * Pequena espera usada enquanto o GitHub
 * termina de materializar a branch main
 * criada a partir do template.
 */
function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}


/*
 * Depois de criar o repo pelo template,
 * o GitHub pode levar alguns instantes
 * para disponibilizar a referência main.
 *
 * Esta função tenta algumas vezes antes
 * de considerar que houve erro.
 */
async function getBranchHeadWithRetry(
  installationToken,
  repoName,
  branch = "main",
  attempts = 8
) {
  const {
    githubOrg
  } = getConfig();

  const owner =
    encodeURIComponent(
      githubOrg
    );

  const repo =
    encodeURIComponent(
      repoName
    );

  const encodedBranch =
    encodeURIComponent(
      branch
    );

  let lastError =
    null;

  for (
    let attempt = 1;
    attempt <= attempts;
    attempt += 1
  ) {
    try {
      const reference =
        await githubRequest(
          `/repos/${owner}/${repo}/git/ref/heads/${encodedBranch}`,
          {
            token:
              installationToken
          }
        );

      const commit =
        await githubRequest(
          `/repos/${owner}/${repo}/git/commits/${reference.object.sha}`,
          {
            token:
              installationToken
          }
        );

      return {
        branch,

        refSha:
          reference.object.sha,

        treeSha:
          commit.tree.sha
      };

    } catch (error) {
      lastError =
        error;

      /*
       * 404:
       * branch ainda não apareceu.
       *
       * 409:
       * repositório ainda está sendo
       * inicializado pelo GitHub.
       */
      if (
        !(
          error instanceof
          GitHubApiError
        ) ||
        ![
          404,
          409
        ].includes(
          error.status
        )
      ) {
        throw error;
      }

      await sleep(
        Math.min(
          500 * attempt,
          2500
        )
      );
    }
  }

  throw (
    lastError ||
    new Error(
      "A branch principal ainda não ficou disponível no GitHub."
    )
  );
}


/*
 * Adiciona todos os arquivos do projeto
 * Spring Boot usando UM ÚNICO commit.
 *
 * Fluxo:
 *
 * arquivos
 *   ↓
 * blobs
 *   ↓
 * tree
 *   ↓
 * commit
 *   ↓
 * atualiza main
 *
 * Isso evita fazer um PUT separado para
 * pom.xml, mvnw, classes, resources etc.
 */
export async function commitFilesToRepository(
  installationToken,
  repoName,
  files,
  {
    branch =
      "main",

    message =
      "chore: configurar projeto Spring Boot"
  } = {}
) {
  if (
    !Array.isArray(
      files
    ) ||
    files.length === 0
  ) {
    return null;
  }

  const {
    githubOrg
  } = getConfig();

  const owner =
    encodeURIComponent(
      githubOrg
    );

  const repo =
    encodeURIComponent(
      repoName
    );


  /*
   * Pegamos o commit atual da main
   * e a árvore do template.
   */
  const head =
    await getBranchHeadWithRetry(
      installationToken,
      repoName,
      branch
    );


  /*
   * Cada arquivo precisa virar um blob
   * no GitHub Git Database API.
   *
   * Usamos Promise.all para executar
   * essas chamadas em paralelo.
   */
  const blobEntries =
    await Promise.all(
      files.map(
        async (file) => {
          const blob =
            await githubRequest(
              `/repos/${owner}/${repo}/git/blobs`,
              {
                method:
                  "POST",

                token:
                  installationToken,

                body: {
                  content:
                    file.content.toString(
                      "base64"
                    ),

                  encoding:
                    "base64"
                }
              }
            );

          return {
            path:
              file.path,

            mode:
              file.mode ||
              "100644",

            type:
              "blob",

            sha:
              blob.sha
          };
        }
      )
    );


  /*
   * Criamos uma nova tree usando
   * a tree do template como base.
   *
   * Dessa forma:
   *
   * LICENSE
   * workflow
   * PR Bot
   * scripts
   *
   * continuam existindo.
   *
   * E os arquivos Spring são adicionados
   * por cima.
   */
  const tree =
    await githubRequest(
      `/repos/${owner}/${repo}/git/trees`,
      {
        method:
          "POST",

        token:
          installationToken,

        body: {
          base_tree:
            head.treeSha,

          tree:
            blobEntries
        }
      }
    );


  /*
   * Criamos um commit novo.
   */
  const commit =
    await githubRequest(
      `/repos/${owner}/${repo}/git/commits`,
      {
        method:
          "POST",

        token:
          installationToken,

        body: {
          message,

          tree:
            tree.sha,

          parents: [
            head.refSha
          ]
        }
      }
    );


  /*
   * Finalmente fazemos a main apontar
   * para o novo commit.
   *
   * force false porque não queremos
   * reescrever histórico.
   */
  await githubRequest(
    `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(
      branch
    )}`,
    {
      method:
        "PATCH",

      token:
        installationToken,

      body: {
        sha:
          commit.sha,

        force:
          false
      }
    }
  );


  return commit;
}