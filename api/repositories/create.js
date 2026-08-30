import {
  applyCors,
  handleOptions
} from "../../lib/cors.js";

import {
  getSessionFromRequest
} from "../../lib/session.js";

import {
  getConfig
} from "../../lib/config.js";

import {
  GitHubApiError,
  getInstallationToken,
  verifyActiveOrganizationMember,
  createRepositoryFromTemplate,
  commitFilesToRepository,
  createMainProtectionRuleset
} from "../../lib/github.js";

import {
  generateSpringBootProject,
  SPRING_BOOT_DEFAULTS
} from "../../lib/spring-initializr.js";


const NAME_REGEX =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const GROUP_ID_REGEX =
  /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;

const PACKAGE_NAME_REGEX =
  /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*$/;


function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /\s+/g,
      "-"
    )
    .replace(
      /[^a-z0-9-]/g,
      ""
    )
    .replace(
      /-+/g,
      "-"
    )
    .replace(
      /^-|-$/g,
      ""
    );
}


function normalizeJavaValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function validateSpringBoot(
  body,
  repoName
) {
  const enabled =
    body?.springBoot?.enabled === true;

  if (!enabled) {
    return {
      ok: true,

      value: {
        enabled: false
      }
    };
  }

  const groupId =
    normalizeJavaValue(
      body.springBoot.groupId
    );

  const artifactId =
    normalizeName(
      body.springBoot.artifactId ||
      repoName
    );

  const packageName =
    normalizeJavaValue(
      body.springBoot.packageName
    );


  if (
    !GROUP_ID_REGEX.test(groupId)
  ) {
    return {
      ok: false,

      message:
        "Group ID inválido. Use um formato como com.example ou br.com.ecociente."
    };
  }


  if (
    !artifactId ||
    artifactId.length > 100 ||
    !NAME_REGEX.test(artifactId)
  ) {
    return {
      ok: false,

      message:
        "Artifact ID inválido. Use apenas letras minúsculas, números e hífens."
    };
  }


  if (
    !PACKAGE_NAME_REGEX.test(
      packageName
    )
  ) {
    return {
      ok: false,

      message:
        "Package Name inválido. Use um package Java como com.example.demo."
    };
  }


  return {
    ok: true,

    value: {
      enabled: true,

      groupId,
      artifactId,
      packageName,

      bootVersion:
        SPRING_BOOT_DEFAULTS.bootVersion,

      language:
        "Java",

      packaging:
        "Jar",

      javaVersion:
        SPRING_BOOT_DEFAULTS.javaVersion,

      dependencies: [
        "Lombok",
        "Spring Boot DevTools",
        "Spring Web"
      ]
    }
  };
}


function validatePayload(body) {
  const name =
    normalizeName(body?.name);

  const description =
    String(
      body?.description || ""
    ).trim();

  const visibility =
    body?.visibility;


  if (
    !name ||
    name.length > 100 ||
    !NAME_REGEX.test(name)
  ) {
    return {
      ok: false,

      message:
        "Nome inválido. Use apenas letras minúsculas, números e hífens."
    };
  }


  if (
    !description ||
    description.length > 350
  ) {
    return {
      ok: false,

      message:
        "Informe uma descrição entre 1 e 350 caracteres."
    };
  }


  if (
    ![
      "public",
      "private"
    ].includes(visibility)
  ) {
    return {
      ok: false,

      message:
        "Visibilidade inválida."
    };
  }


  const springValidation =
    validateSpringBoot(
      body,
      name
    );


  if (!springValidation.ok) {
    return springValidation;
  }


  return {
    ok: true,

    value: {
      name,
      description,
      visibility,

      isPrivate:
        visibility === "private",

      springBoot:
        springValidation.value
    }
  };
}


export default async function handler(
  req,
  res
) {
  if (
    handleOptions(req, res)
  ) {
    return;
  }


  applyCors(
    req,
    res
  );


  if (
    req.method !== "POST"
  ) {
    return res
      .status(405)
      .json({
        message:
          "Método não permitido."
      });
  }


  let session;


  try {
    session =
      getSessionFromRequest(req);
  } catch {
    return res
      .status(401)
      .json({
        message:
          "Sua sessão expirou. Entre novamente com o GitHub."
      });
  }


  const validation =
    validatePayload(req.body);


  if (!validation.ok) {
    return res
      .status(400)
      .json({
        message:
          validation.message
      });
  }


  const payload =
    validation.value;


  const {
    githubOrg,
    templateOwner,
    templateRepo
  } = getConfig();


  try {
    const installationToken =
      await getInstallationToken();


    const activeMember =
      await verifyActiveOrganizationMember(
        installationToken,
        session.login
      );


    if (!activeMember) {
      return res
        .status(403)
        .json({
          message:
            "Sua conta não é um membro ativo da organização EcoCiente-Instituto-J-F."
        });
    }


    /*
     * Se for Spring Boot, primeiro
     * tentamos gerar o projeto.
     *
     * Dessa forma, se start.spring.io
     * estiver indisponível, não criamos
     * um repositório incompleto.
     */
    let springProject =
      null;


    if (
      payload.springBoot.enabled
    ) {
      springProject =
        await generateSpringBootProject({
          groupId:
            payload.springBoot.groupId,

          artifactId:
            payload.springBoot.artifactId,

          packageName:
            payload.springBoot.packageName,

          description:
            payload.description
        });
    }


    /*
     * Sempre cria usando o
     * ecociente-repo-template.
     *
     * Assim continuam vindo:
     *
     * - LICENSE MIT
     * - PR Bot
     * - workflow
     * - scripts
     * - arquivos padrão
     */
    const repository =
      await createRepositoryFromTemplate(
        installationToken,
        payload
      );


    const warnings =
      [];


    let springConfigured =
      false;

    let springReason =
      "";


    /*
     * Se for API Spring Boot,
     * adicionamos todos os arquivos
     * em UM ÚNICO commit.
     *
     * Isso é bem mais rápido
     * do que criar arquivo por arquivo.
     */
    if (springProject) {
      try {
        await commitFilesToRepository(
          installationToken,

          payload.name,

          springProject.files,

          {
            branch:
              repository.default_branch ||
              "main",

            message:
              "chore: configurar projeto Spring Boot"
          }
        );


        springConfigured =
          true;
      } catch (error) {
        console.error(
          "[Spring Boot]",
          error
        );


        springReason =
          error.message ||
          "falha ao adicionar os arquivos Spring Boot";


        warnings.push(
          `Spring Boot: ${springReason}`
        );
      }
    }


    /*
     * A proteção é criada por último.
     *
     * Isso evita que a regra da main
     * bloqueie o commit inicial do
     * projeto Spring.
     */
    let rulesetApplied =
      false;

    let rulesetReason =
      "";


    try {
      await createMainProtectionRuleset(
        installationToken,
        payload.name
      );


      rulesetApplied =
        true;
    } catch (error) {
      console.error(
        "[Proteção Main]",
        error
      );


      rulesetReason =
        error.message ||
        "falha ao criar a ruleset";


      warnings.push(
        `Proteção Main: ${rulesetReason}`
      );
    }


    return res
      .status(201)
      .json({
        repository: {
          name:
            repository.name,

          fullName:
            repository.full_name ||
            `${githubOrg}/${payload.name}`,

          url:
            repository.html_url ||
            `https://github.com/${githubOrg}/${payload.name}`,

          visibility:
            payload.visibility
        },


        template:
          `${templateOwner}/${templateRepo}`,


        templateFiles: {
          automaticPullRequests:
            true,

          mitLicense:
            true,

          gitignore:
            false
        },


        springBoot: {
          requested:
            payload.springBoot.enabled,

          configured:
            payload.springBoot.enabled
              ? springConfigured
              : false,

          reason:
            payload.springBoot.enabled &&
            !springConfigured
              ? springReason
              : "",

          config:
            payload.springBoot.enabled
              ? {
                  bootVersion:
                    SPRING_BOOT_DEFAULTS.bootVersion,

                  language:
                    "Java",

                  groupId:
                    payload.springBoot.groupId,

                  artifactId:
                    payload.springBoot.artifactId,

                  packageName:
                    payload.springBoot.packageName,

                  packaging:
                    "Jar",

                  javaVersion:
                    SPRING_BOOT_DEFAULTS.javaVersion,

                  dependencies: [
                    "Lombok",
                    "Spring Boot DevTools",
                    "Spring Web"
                  ]
                }
              : null
        },


        ruleset: {
          name:
            "Proteção Main",

          applied:
            rulesetApplied,

          reason:
            rulesetApplied
              ? ""
              : rulesetReason
        },


        warnings
      });


  } catch (error) {
    console.error(error);


    if (
      error instanceof GitHubApiError
    ) {
      if (
        error.status === 403
      ) {
        return res
          .status(403)
          .json({
            message:
              "O GitHub App não possui permissão suficiente para criar ou configurar o repositório."
          });
      }


      if (
        error.status === 404
      ) {
        return res
          .status(404)
          .json({
            message:
              "Não foi possível acessar o template ou a instalação do GitHub App."
          });
      }


      if (
        error.status === 422
      ) {
        return res
          .status(422)
          .json({
            message:
              error.message ||
              "O GitHub rejeitou os dados. Verifique se já existe um repositório com esse nome."
          });
      }
    }


    const message =
      String(
        error?.message || ""
      );


    if (
      message.includes(
        "Spring Initializr"
      ) ||
      message.includes(
        "projeto Maven válido"
      )
    ) {
      return res
        .status(502)
        .json({
          message:
            (
              `Não foi possível gerar o projeto Spring Boot. ` +
              `${message}`
            ).trim()
        });
    }


    return res
      .status(500)
      .json({
        message:
          "Não foi possível concluir a criação do repositório. Tente novamente ou contate o Mestre DevOps Julio."
      });
  }
}