import { inflateRawSync } from "node:zlib";

const SPRING_INITIALIZR_URL =
  "https://start.spring.io/starter.zip";

export const SPRING_BOOT_DEFAULTS = Object.freeze({
  bootVersion: "3.5.4",
  projectVersion: "1.0.0",
  swaggerVersion: "2.8.9",
  dependencyManagementVersion: "1.1.7",
  gradleVersion: "8.14.3",
  language: "java",
  packaging: "jar",
  javaVersion: "19",
  dependencies: [
    "lombok",
    "devtools",
    "web"
  ]
});

const ZIP_LOCAL_FILE_HEADER =
  0x04034b50;

const ZIP_CENTRAL_DIRECTORY_HEADER =
  0x02014b50;

const ZIP_END_OF_CENTRAL_DIRECTORY =
  0x06054b50;

function readUInt16LE(
  buffer,
  offset
) {
  return buffer.readUInt16LE(
    offset
  );
}

function readUInt32LE(
  buffer,
  offset
) {
  return buffer.readUInt32LE(
    offset
  );
}

function findEndOfCentralDirectory(
  buffer
) {
  const minimumOffset =
    Math.max(
      0,
      buffer.length -
        65_557
    );

  for (
    let offset =
      buffer.length - 22;

    offset >= minimumOffset;

    offset -= 1
  ) {
    if (
      readUInt32LE(
        buffer,
        offset
      ) ===
      ZIP_END_OF_CENTRAL_DIRECTORY
    ) {
      return offset;
    }
  }

  throw new Error(
    "Não foi possível localizar o diretório central do ZIP retornado pelo Spring Initializr."
  );
}

function parseZip(
  buffer
) {
  const eocdOffset =
    findEndOfCentralDirectory(
      buffer
    );

  const totalEntries =
    readUInt16LE(
      buffer,
      eocdOffset + 10
    );

  const centralDirectoryOffset =
    readUInt32LE(
      buffer,
      eocdOffset + 16
    );

  const files = [];

  let offset =
    centralDirectoryOffset;

  for (
    let index = 0;
    index < totalEntries;
    index += 1
  ) {
    const signature =
      readUInt32LE(
        buffer,
        offset
      );

    if (
      signature !==
      ZIP_CENTRAL_DIRECTORY_HEADER
    ) {
      throw new Error(
        "O ZIP retornado pelo Spring Initializr possui um diretório central inválido."
      );
    }

    const compressionMethod =
      readUInt16LE(
        buffer,
        offset + 10
      );

    const compressedSize =
      readUInt32LE(
        buffer,
        offset + 20
      );

    const uncompressedSize =
      readUInt32LE(
        buffer,
        offset + 24
      );

    const fileNameLength =
      readUInt16LE(
        buffer,
        offset + 28
      );

    const extraFieldLength =
      readUInt16LE(
        buffer,
        offset + 30
      );

    const fileCommentLength =
      readUInt16LE(
        buffer,
        offset + 32
      );

    const externalAttributes =
      readUInt32LE(
        buffer,
        offset + 38
      );

    const localHeaderOffset =
      readUInt32LE(
        buffer,
        offset + 42
      );

    const fileName =
      buffer
        .subarray(
          offset + 46,
          offset + 46 +
            fileNameLength
        )
        .toString("utf8");

    if (
      !fileName.endsWith("/")
    ) {
      const localSignature =
        readUInt32LE(
          buffer,
          localHeaderOffset
        );

      if (
        localSignature !==
        ZIP_LOCAL_FILE_HEADER
      ) {
        throw new Error(
          `Cabeçalho ZIP inválido para ${fileName}.`
        );
      }

      const localFileNameLength =
        readUInt16LE(
          buffer,
          localHeaderOffset + 26
        );

      const localExtraLength =
        readUInt16LE(
          buffer,
          localHeaderOffset + 28
        );

      const dataStart =
        localHeaderOffset +
        30 +
        localFileNameLength +
        localExtraLength;

      const compressedData =
        buffer.subarray(
          dataStart,
          dataStart +
            compressedSize
        );

      let content;

      if (
        compressionMethod === 0
      ) {
        content =
          Buffer.from(
            compressedData
          );
      } else if (
        compressionMethod === 8
      ) {
        content =
          inflateRawSync(
            compressedData
          );
      } else {
        throw new Error(
          `Método de compressão ZIP não suportado (${compressionMethod}) no arquivo ${fileName}.`
        );
      }

      if (
        content.length !==
        uncompressedSize
      ) {
        throw new Error(
          `O arquivo ${fileName} foi descompactado com tamanho inesperado.`
        );
      }

      const unixMode =
        (
          externalAttributes >>>
          16
        ) & 0xffff;

      const executable =
        Boolean(
          unixMode &
          0o111
        );

      files.push({
        path:
          fileName.replace(
            /^\.\//,
            ""
          ),

        mode:
          executable
            ? "100755"
            : "100644",

        content
      });
    }

    offset +=
      46 +
      fileNameLength +
      extraFieldLength +
      fileCommentLength;
  }

  return files;
}

function stripBaseDirectory(
  files,
  artifactId
) {
  const expectedPrefix =
    `${artifactId}/`;

  const allInsideArtifact =
    files.length > 0 &&
    files.every(
      (file) =>
        file.path.startsWith(
          expectedPrefix
        )
    );

  if (
    allInsideArtifact
  ) {
    return files.map(
      (file) => ({
        ...file,

        path:
          file.path.slice(
            expectedPrefix.length
          )
      })
    );
  }

  const firstSegments =
    new Set(
      files
        .map(
          (file) =>
            file.path.split(
              "/"
            )[0]
        )
        .filter(Boolean)
    );

  if (
    firstSegments.size !== 1
  ) {
    return files;
  }

  const [
    commonRoot
  ] =
    firstSegments;

  if (
    !files.every(
      (file) =>
        file.path.startsWith(
          `${commonRoot}/`
        )
    )
  ) {
    return files;
  }

  return files.map(
    (file) => ({
      ...file,

      path:
        file.path.slice(
          commonRoot.length + 1
        )
    })
  );
}

function filterGeneratedFiles(
  files
) {
  return files.filter(
    (file) => {
      if (
        !file.path
      ) {
        return false;
      }

      if (
        file.path ===
        ".gitignore"
      ) {
        return false;
      }

      if (
        file.path === ".git" ||
        file.path.startsWith(
          ".git/"
        )
      ) {
        return false;
      }

      if (
        file.path ===
          "LICENSE" ||
        file.path ===
          "LICENSE.md"
      ) {
        return false;
      }

      return true;
    }
  );
}

function createEcoCienteBuildGradle(
  groupId
) {
  return `plugins {
\tid 'java'
\tid 'org.springframework.boot' version '${SPRING_BOOT_DEFAULTS.bootVersion}'
\tid 'io.spring.dependency-management' version '${SPRING_BOOT_DEFAULTS.dependencyManagementVersion}'
}

group = '${groupId}'
version = '${SPRING_BOOT_DEFAULTS.projectVersion}'

java {
\ttoolchain {
\t\tlanguageVersion = JavaLanguageVersion.of(${SPRING_BOOT_DEFAULTS.javaVersion})
\t}
}

repositories {
\tmavenCentral()
}

dependencies {
\timplementation 'org.springframework.boot:spring-boot-starter-web'
\timplementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:${SPRING_BOOT_DEFAULTS.swaggerVersion}'

\tcompileOnly 'org.projectlombok:lombok'
\tdevelopmentOnly 'org.springframework.boot:spring-boot-devtools'
\tannotationProcessor 'org.projectlombok:lombok'

\ttestImplementation 'org.springframework.boot:spring-boot-starter-test'
\ttestRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

tasks.named('test') {
\tuseJUnitPlatform()
}
`;
}

function replaceFileContent(
  files,
  path,
  content
) {
  const index =
    files.findIndex(
      (file) =>
        file.path === path
    );

  if (
    index === -1
  ) {
    throw new Error(
      `Arquivo obrigatório não encontrado no projeto gerado: ${path}`
    );
  }

  const updatedFiles =
    [...files];

  updatedFiles[
    index
  ] = {
    ...updatedFiles[
      index
    ],

    content:
      Buffer.from(
        content,
        "utf8"
      )
  };

  return updatedFiles;
}

function customizeBuildGradle(
  files,
  groupId
) {
  const buildGradle =
    createEcoCienteBuildGradle(
      groupId
    );

  return replaceFileContent(
    files,
    "build.gradle",
    buildGradle
  );
}

function customizeGradleWrapper(
  files
) {
  const wrapperPath =
    "gradle/wrapper/gradle-wrapper.properties";

  const index =
    files.findIndex(
      (file) =>
        file.path ===
        wrapperPath
    );

  if (
    index === -1
  ) {
    throw new Error(
      "O Spring Initializr não retornou gradle-wrapper.properties."
    );
  }

  const originalContent =
    files[
      index
    ].content.toString(
      "utf8"
    );

  const distributionRegex =
    /^distributionUrl=.*$/m;

  if (
    !distributionRegex.test(
      originalContent
    )
  ) {
    throw new Error(
      "Não foi possível localizar distributionUrl no Gradle Wrapper."
    );
  }

  const customizedContent =
    originalContent.replace(
      distributionRegex,
      (
        "distributionUrl=" +
        "https\\://services.gradle.org/distributions/" +
        `gradle-${SPRING_BOOT_DEFAULTS.gradleVersion}-bin.zip`
      )
    );

  const updatedFiles =
    [...files];

  updatedFiles[
    index
  ] = {
    ...updatedFiles[
      index
    ],

    content:
      Buffer.from(
        customizedContent,
        "utf8"
      )
  };

  return updatedFiles;
}

function validateFinalProject(
  files
) {
  const buildGradle =
    files.find(
      (file) =>
        file.path ===
        "build.gradle"
    );

  if (
    !buildGradle
  ) {
    throw new Error(
      "build.gradle não encontrado após aplicar o padrão EcoCiente."
    );
  }

  const content =
    buildGradle.content.toString(
      "utf8"
    );

  const requiredValues = [
    `org.springframework.boot' version '${SPRING_BOOT_DEFAULTS.bootVersion}`,
    `version = '${SPRING_BOOT_DEFAULTS.projectVersion}'`,
    `JavaLanguageVersion.of(${SPRING_BOOT_DEFAULTS.javaVersion})`,
    "spring-boot-starter-web",
    `springdoc-openapi-starter-webmvc-ui:${SPRING_BOOT_DEFAULTS.swaggerVersion}`,
    "org.projectlombok:lombok",
    "spring-boot-devtools"
  ];

  for (
    const requiredValue
    of requiredValues
  ) {
    if (
      !content.includes(
        requiredValue
      )
    ) {
      throw new Error(
        `O build.gradle final não contém a configuração esperada: ${requiredValue}`
      );
    }
  }

  if (
    !files.some(
      (file) =>
        file.path ===
        "gradlew"
    )
  ) {
    throw new Error(
      "Gradle Wrapper não encontrado: gradlew."
    );
  }

  if (
    !files.some(
      (file) =>
        file.path.startsWith(
          "src/main/java/"
        )
    )
  ) {
    throw new Error(
      "A estrutura src/main/java não foi encontrada."
    );
  }
}

export async function generateSpringBootProject({
  groupId,
  artifactId,
  packageName,
  description
}) {
  /*
   * O start.spring.io remove versões antigas
   * conforme sua matriz de suporte evolui.
   *
   * Por isso não enviamos bootVersion nem
   * javaVersion nesta chamada.
   *
   * O Initializr é usado para gerar:
   *
   * - estrutura Java
   * - Gradle Wrapper
   * - classe Application
   * - testes iniciais
   *
   * Depois o Criador aplica o padrão fixo
   * do EcoCiente no build.gradle e Wrapper.
   */
  const params =
    new URLSearchParams({
      type:
        "gradle-project",

      language:
        SPRING_BOOT_DEFAULTS.language,

      groupId,

      artifactId,

      name:
        artifactId,

      description,

      packageName,

      packaging:
        SPRING_BOOT_DEFAULTS.packaging,

      dependencies:
        SPRING_BOOT_DEFAULTS.dependencies.join(
          ","
        )
    });

  const url =
    `${SPRING_INITIALIZR_URL}?${params.toString()}`;

  console.log(
    "[Spring Initializr] Gerando estrutura base..."
  );

  console.log(
    `[EcoCiente] Spring Boot final: ${SPRING_BOOT_DEFAULTS.bootVersion}`
  );

  console.log(
    `[EcoCiente] Java final: ${SPRING_BOOT_DEFAULTS.javaVersion}`
  );

  console.log(
    `[EcoCiente] Gradle final: ${SPRING_BOOT_DEFAULTS.gradleVersion}`
  );

  console.log(
    `[EcoCiente] Versão inicial: ${SPRING_BOOT_DEFAULTS.projectVersion}`
  );

  console.log(
    `[EcoCiente] Swagger: ${SPRING_BOOT_DEFAULTS.swaggerVersion}`
  );

  console.log(
    `[Spring Initializr] Group: ${groupId}`
  );

  console.log(
    `[Spring Initializr] Artifact: ${artifactId}`
  );

  console.log(
    `[Spring Initializr] Package: ${packageName}`
  );

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          "User-Agent":
            "EcoCiente-Repository-Creator",

          Accept:
            "application/zip"
        },

        redirect:
          "follow"
      }
    );

  if (
    !response.ok
  ) {
    const responseText =
      await response
        .text()
        .catch(
          () => ""
        );

    console.error(
      "[Spring Initializr] Status:",
      response.status
    );

    console.error(
      "[Spring Initializr] Resposta:",
      responseText
    );

    throw new Error(
      (
        `Spring Initializr recusou a configuração ` +
        `(${response.status}). ` +
        `${responseText}`
      ).trim()
    );
  }

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  console.log(
    "[Spring Initializr] Content-Type:",
    contentType
  );

  const archive =
    Buffer.from(
      await response.arrayBuffer()
    );

  if (
    archive.length === 0
  ) {
    throw new Error(
      "O Spring Initializr retornou um ZIP vazio."
    );
  }

  let parsedFiles;

  try {
    parsedFiles =
      parseZip(
        archive
      );
  } catch (error) {
    console.error(
      "[Spring Initializr] Erro ao ler ZIP:",
      error
    );

    throw new Error(
      "O Spring Initializr respondeu, mas o ZIP gerado não pôde ser interpretado."
    );
  }

  const normalizedFiles =
    stripBaseDirectory(
      parsedFiles,
      artifactId
    );

  let files =
    filterGeneratedFiles(
      normalizedFiles
    );

  files =
    customizeBuildGradle(
      files,
      groupId
    );

  files =
    customizeGradleWrapper(
      files
    );

  validateFinalProject(
    files
  );

  console.log(
    `[EcoCiente] ${files.length} arquivos preparados com sucesso.`
  );

  return {
    files,

    metadata: {
      ...SPRING_BOOT_DEFAULTS,

      groupId,

      artifactId,

      packageName
    }
  };
}