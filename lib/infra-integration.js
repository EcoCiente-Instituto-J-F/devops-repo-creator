import {
  GitHubApiError,
  getRepositoryFileContent,
  ensureRepositoryBranch,
  repositoryFileExists,
  getOpenRepositoryPullRequest,
  commitFilesToRepository,
  createRepositoryPullRequest
} from "./github.js";

const APP_NAME_REGEX =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const VERSION_REGEX =
  /^[0-9]+\.[0-9]+\.[0-9]+$/;

const DEPLOY_WORKFLOW_PATH =
  ".github/workflows/deploy-aws.yaml";

const INFRA_REPOSITORY =
  "devops-infra-ecociente";


function normalizeText(content) {
  return String(content || "")
    .replace(/\r\n/g, "\n");
}


function withFinalNewline(content) {
  return `${String(content || "")
    .replace(/\n+$/g, "")}\n`;
}


function normalizeComparableText(
  content
) {
  return withFinalNewline(
    normalizeText(content)
  );
}


function textFile(
  path,
  content,
  mode = "100644"
) {
  return {
    path,
    mode,

    content:
      Buffer.from(
        withFinalNewline(content),
        "utf8"
      )
  };
}


export function deriveApplicationName(
  repositoryName
) {
  let applicationName =
    String(repositoryName || "")
      .trim()
      .toLowerCase();


  if (
    applicationName.startsWith(
      "ds-"
    )
  ) {
    applicationName =
      applicationName.slice(3);
  }


  if (
    applicationName.endsWith(
      "-api"
    )
  ) {
    applicationName =
      applicationName.slice(
        0,
        -4
      );
  }


  applicationName =
    applicationName
      .replace(
        /_/g,
        "-"
      )
      .replace(
        /[^a-z0-9-]+/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^-|-$/g,
        ""
      );


  if (
    !applicationName ||
    !APP_NAME_REGEX.test(
      applicationName
    )
  ) {
    throw new Error(
      "Não foi possível derivar um nome válido para a aplicação."
    );
  }


  return applicationName;
}


function validateVersion(
  version
) {
  const normalizedVersion =
    String(version || "")
      .trim();


  if (
    !VERSION_REGEX.test(
      normalizedVersion
    )
  ) {
    throw new Error(
      "Versão inválida. Use o formato MAJOR.MINOR.PATCH, por exemplo 1.0.0."
    );
  }


  return normalizedVersion;
}


function createInfrastructureDescriptor({
  repositoryName,
  version = "1.0.0"
}) {
  const applicationName =
    deriveApplicationName(
      repositoryName
    );

  const applicationVersion =
    validateVersion(
      version
    );


  return {
    repository:
      INFRA_REPOSITORY,

    applicationName,

    version:
      applicationVersion,

    imageTag:
      `${applicationName}-${applicationVersion}`,

    branch:
      `creator/add-${applicationName}`,

    valuesPath:
      `kubernetes/aws/apps/${applicationName}/values.yaml`,

    deployWorkflowPath:
      DEPLOY_WORKFLOW_PATH
  };
}


export function createApplicationValues({
  repositoryName,
  version = "1.0.0"
}) {
  const applicationName =
    deriveApplicationName(
      repositoryName
    );

  const applicationVersion =
    validateVersion(
      version
    );


  return withFinalNewline(
`replicaCount: 1

fullnameOverride: ${applicationName}-api

image:
  repository: ecociente/ecociente
  tag: ${applicationName}-${applicationVersion}
  pullPolicy: IfNotPresent

containerPort: 8080

configMap:
  enabled: true
  nameOverride: ${applicationName}-config
  data: {}

secret:
  existingSecret: ""

service:
  enabled: true
  type: ClusterIP
  port: 8080

ingress:
  enabled: false
  className: traefik
  host: ""
  path: /
  pathType: Prefix
  annotations: {}

  tls:
    enabled: false
    secretName: ""

probes:
  startup:
    enabled: true
    periodSeconds: 5
    timeoutSeconds: 2
    failureThreshold: 30

  readiness:
    enabled: true
    periodSeconds: 10
    timeoutSeconds: 2
    failureThreshold: 3

  liveness:
    enabled: true
    periodSeconds: 20
    timeoutSeconds: 2
    failureThreshold: 3

resources:
  requests:
    cpu: 100m
    memory: 256Mi

  limits:
    cpu: 500m
    memory: 512Mi

podLabels: {}`
  );
}


export function addApplicationToDeployWorkflow(
  workflowContent,
  applicationName
) {
  const normalizedApplicationName =
    deriveApplicationName(
      applicationName
    );

  const content =
    normalizeText(
      workflowContent
    );

  const lines =
    content.split("\n");


  const applicationIndex =
    lines.findIndex(
      (line) =>
        line ===
        "      application:"
    );


  if (
    applicationIndex === -1
  ) {
    throw new Error(
      "Não foi possível localizar o input application no deploy-aws.yaml."
    );
  }


  let optionsIndex =
    -1;


  for (
    let index =
      applicationIndex + 1;

    index < lines.length;

    index += 1
  ) {
    const line =
      lines[index];


    if (
      line ===
      "        options:"
    ) {
      optionsIndex =
        index;

      break;
    }


    if (
      /^      [a-zA-Z0-9_-]+:$/.test(
        line
      )
    ) {
      break;
    }
  }


  if (
    optionsIndex === -1
  ) {
    throw new Error(
      "Não foi possível localizar options do input application no deploy-aws.yaml."
    );
  }


  const optionPrefix =
    "          - ";

  let optionEnd =
    optionsIndex + 1;

  const existingApplications =
    [];


  while (
    optionEnd < lines.length &&
    lines[optionEnd].startsWith(
      optionPrefix
    )
  ) {
    const currentApplication =
      lines[optionEnd]
        .slice(
          optionPrefix.length
        )
        .trim();


    if (currentApplication) {
      existingApplications.push(
        currentApplication
      );
    }


    optionEnd += 1;
  }


  if (
    existingApplications.includes(
      normalizedApplicationName
    )
  ) {
    return withFinalNewline(
      content
    );
  }


  lines.splice(
    optionEnd,
    0,
    `${optionPrefix}${normalizedApplicationName}`
  );


  return withFinalNewline(
    lines.join("\n")
  );
}


function isApplicationRegisteredInDeployWorkflow(
  workflowContent,
  applicationName
) {
  const updatedWorkflow =
    addApplicationToDeployWorkflow(
      workflowContent,
      applicationName
    );


  return (
    normalizeComparableText(
      workflowContent
    ) ===
    normalizeComparableText(
      updatedWorkflow
    )
  );
}


export function createInfrastructureFiles({
  repositoryName,
  deployWorkflowContent,
  version = "1.0.0"
}) {
  const descriptor =
    createInfrastructureDescriptor({
      repositoryName,
      version
    });

  const valuesContent =
    createApplicationValues({
      repositoryName,
      version:
        descriptor.version
    });

  const deployWorkflow =
    addApplicationToDeployWorkflow(
      deployWorkflowContent,
      descriptor.applicationName
    );


  return {
    ...descriptor,

    files: [
      textFile(
        descriptor.valuesPath,
        valuesContent
      ),

      textFile(
        DEPLOY_WORKFLOW_PATH,
        deployWorkflow
      )
    ]
  };
}


function createPullRequestBody(
  integration,
  repositoryName
) {
  return `## Integração automática de infraestrutura

Esta Pull Request foi criada automaticamente pelo EcoCiente Repository Creator.

### Aplicação

\`${integration.applicationName}\`

### Repositório de origem

\`${repositoryName}\`

### Imagem inicial

\`ecociente/ecociente:${integration.imageTag}\`

### Alterações

- adiciona \`${integration.valuesPath}\`
- registra \`${integration.applicationName}\` no workflow \`${integration.deployWorkflowPath}\`
- mantém o Ingress desabilitado inicialmente
- utiliza a porta padrão 8080
- não cria secrets ou configurações de banco automaticamente

### Segurança de implantação

A aplicação não recebe uma rota pública automaticamente.

O Ingress inicial permanece:

\`\`\`yaml
ingress:
  enabled: false
\`\`\`

A publicação externa deverá ser configurada posteriormente de forma explícita.
`;
}


function mapPullRequest(
  pullRequest
) {
  return {
    number:
      pullRequest?.number || null,

    url:
      pullRequest?.html_url || "",

    state:
      pullRequest?.state || ""
  };
}


export async function integrateRepositoryWithInfrastructure(
  installationToken,
  {
    repositoryName,
    version = "1.0.0"
  }
) {
  if (!installationToken) {
    throw new Error(
      "Installation token é obrigatório para integrar a infraestrutura."
    );
  }


  const normalizedRepositoryName =
    String(repositoryName || "")
      .trim();


  if (!normalizedRepositoryName) {
    throw new Error(
      "Informe o nome do repositório que será integrado à infraestrutura."
    );
  }


  const integration =
    createInfrastructureDescriptor({
      repositoryName:
        normalizedRepositoryName,

      version
    });


  /*
   * Trabalhamos sempre a partir do estado
   * atual da main do repositório central.
   */
  const mainDeployWorkflow =
    await getRepositoryFileContent(
      installationToken,
      integration.repository,
      integration.deployWorkflowPath,
      {
        ref:
          "main"
      }
    );


  /*
   * Nunca sobrescrevemos um values.yaml
   * que já existe na main.
   */
  const valuesAlreadyInMain =
    await repositoryFileExists(
      installationToken,
      integration.repository,
      integration.valuesPath,
      {
        ref:
          "main"
      }
    );


  if (valuesAlreadyInMain) {
    const registeredInMain =
      isApplicationRegisteredInDeployWorkflow(
        mainDeployWorkflow,
        integration.applicationName
      );


    if (!registeredInMain) {
      throw new Error(
        `A infraestrutura de ${integration.applicationName} já possui values.yaml na main, ` +
        "mas a aplicação não está registrada no deploy-aws.yaml. Revise o devops-infra-ecociente manualmente."
      );
    }


    /*
     * A integração já foi concluída.
     * Não sobrescrevemos configuração
     * e não criamos outra PR.
     */
    return {
      ...integration,

      alreadyIntegrated:
        true,

      branchCreated:
        false,

      reusedPullRequest:
        false,

      commit: {
        sha:
          ""
      },

      pullRequest: {
        number:
          null,

        url:
          "",

        state:
          ""
      }
    };
  }


  /*
   * A branch pode existir devido
   * a uma tentativa anterior.
   */
  const branchResult =
    await ensureRepositoryBranch(
      installationToken,
      integration.repository,
      integration.branch,
      {
        baseBranch:
          "main"
      }
    );


  /*
   * Se já houver PR aberta para
   * essa branch, reutilizamos.
   */
  const existingPullRequest =
    await getOpenRepositoryPullRequest(
      installationToken,
      integration.repository,
      {
        head:
          integration.branch,

        base:
          "main"
      }
    );


  const valuesAlreadyInBranch =
    await repositoryFileExists(
      installationToken,
      integration.repository,
      integration.valuesPath,
      {
        ref:
          integration.branch
      }
    );


  const branchDeployWorkflow =
    await getRepositoryFileContent(
      installationToken,
      integration.repository,
      integration.deployWorkflowPath,
      {
        ref:
          integration.branch
      }
    );


  /*
   * Calculamos o workflow desejado
   * usando a main mais atual.
   */
  const desiredDeployWorkflow =
    addApplicationToDeployWorkflow(
      mainDeployWorkflow,
      integration.applicationName
    );


  const filesToCommit =
    [];


  /*
   * Só criamos values.yaml se ele
   * ainda não existir na branch.
   */
  if (!valuesAlreadyInBranch) {
    filesToCommit.push(
      textFile(
        integration.valuesPath,
        createApplicationValues({
          repositoryName:
            normalizedRepositoryName,

          version:
            integration.version
        })
      )
    );
  }


  /*
   * Atualizamos o deploy workflow
   * somente quando necessário.
   */
  if (
    normalizeComparableText(
      branchDeployWorkflow
    ) !==
    normalizeComparableText(
      desiredDeployWorkflow
    )
  ) {
    filesToCommit.push(
      textFile(
        integration.deployWorkflowPath,
        desiredDeployWorkflow
      )
    );
  }


  let commit =
    null;


  if (filesToCommit.length > 0) {
    commit =
      await commitFilesToRepository(
        installationToken,
        integration.repository,
        filesToCommit,
        {
          branch:
            integration.branch,

          message:
            `feat: adiciona infraestrutura da aplicação ${integration.applicationName}`
        }
      );
  }


  let pullRequest =
    existingPullRequest;


  /*
   * Só abre uma PR caso ainda
   * não exista uma aberta.
   */
  if (!pullRequest) {
    try {
      pullRequest =
        await createRepositoryPullRequest(
          installationToken,
          integration.repository,
          {
            title:
              `feat: adiciona infraestrutura da aplicação ${integration.applicationName}`,

            head:
              integration.branch,

            base:
              "main",

            body:
              createPullRequestBody(
                integration,
                normalizedRepositoryName
              )
          }
        );

    } catch (error) {
      /*
       * Condição de corrida:
       *
       * duas execuções tentam abrir
       * a mesma PR simultaneamente.
       *
       * Uma pode receber 422.
       */
      if (
        error instanceof
          GitHubApiError &&
        error.status === 422
      ) {
        pullRequest =
          await getOpenRepositoryPullRequest(
            installationToken,
            integration.repository,
            {
              head:
                integration.branch,

              base:
                "main"
            }
          );
      }


      if (!pullRequest) {
        throw error;
      }
    }
  }


  return {
    ...integration,

    alreadyIntegrated:
      false,

    branchCreated:
      branchResult.created,

    reusedPullRequest:
      Boolean(
        existingPullRequest
      ),

    commit: {
      sha:
        commit?.sha || ""
    },

    pullRequest:
      mapPullRequest(
        pullRequest
      )
  };
}