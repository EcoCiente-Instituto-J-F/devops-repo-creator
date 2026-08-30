import { inflateRawSync } from "node:zlib";

const SPRING_INITIALIZR_URL =
  "https://start.spring.io/starter.zip";

export const SPRING_BOOT_DEFAULTS = Object.freeze({
  bootVersion: "4.1.0",
  language: "java",
  packaging: "jar",
  javaVersion: "17",
  dependencies: [
    "lombok",
    "devtools",
    "web"
  ]
});


/*
 * ==========================================================
 * LEITOR DE ZIP
 * ==========================================================
 *
 * O Spring Initializr retorna um .zip.
 *
 * Para não adicionar dependência externa ao projeto,
 * fazemos a leitura do ZIP usando recursos nativos do Node.
 */


/*
 * Assinaturas do formato ZIP.
 */
const ZIP_LOCAL_FILE_HEADER =
  0x04034b50;

const ZIP_CENTRAL_DIRECTORY_HEADER =
  0x02014b50;

const ZIP_END_OF_CENTRAL_DIRECTORY =
  0x06054b50;


/*
 * Lê inteiro unsigned little-endian.
 */
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


/*
 * Procura o End Of Central Directory.
 *
 * Essa estrutura fica próxima ao fim
 * de praticamente todo arquivo ZIP.
 */
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


/*
 * Extrai os arquivos do ZIP.
 *
 * O Initializr normalmente usa:
 *
 * method 0 = stored
 * method 8 = deflate
 */
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

  const files =
    [];

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


    /*
     * Diretórios terminam com "/".
     * Não precisamos criar entries para eles.
     */
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


      /*
       * O bit de execução normalmente fica
       * nos atributos Unix superiores.
       */
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


/*
 * Em alguns formatos o Initializr pode
 * colocar tudo dentro de uma pasta base.
 *
 * Se todos os arquivos estiverem dentro
 * de artifactId/, removemos essa pasta.
 */
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


  /*
   * O ZIP do Initializr também pode
   * possuir uma pasta base com outro nome.
   *
   * Detectamos isso caso absolutamente
   * todos os arquivos tenham o mesmo
   * primeiro segmento.
   */
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


  /*
   * Só removemos se realmente houver
   * "/" nos caminhos.
   */
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


/*
 * Não queremos que o Initializr
 * sobrescreva alguns arquivos padrão
 * controlados pelo template EcoCiente.
 */
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


      /*
       * Seu padrão do projeto continua
       * sem .gitignore.
       */
      if (
        file.path ===
        ".gitignore"
      ) {
        return false;
      }


      /*
       * Nunca permitir alteração do
       * diretório interno .git.
       */
      if (
        file.path === ".git" ||
        file.path.startsWith(
          ".git/"
        )
      ) {
        return false;
      }


      /*
       * A LICENSE MIT continua vindo
       * do ecociente-repo-template.
       */
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


/*
 * ==========================================================
 * SPRING INITIALIZR
 * ==========================================================
 */

export async function generateSpringBootProject({
  groupId,
  artifactId,
  packageName,
  description
}) {
  /*
   * Estes são exatamente os dados
   * equivalentes ao fluxo:
   *
   * Spring Initializr
   * Maven
   * Java
   * Boot 4.1.0
   * Jar
   * Java 17
   *
   * Lombok
   * DevTools
   * Spring Web
   */
  const params =
    new URLSearchParams({
      type:
        "maven-project",

      language:
        SPRING_BOOT_DEFAULTS.language,

      bootVersion:
        SPRING_BOOT_DEFAULTS.bootVersion,

      groupId,

      artifactId,

      name:
        artifactId,

      description,

      packageName,

      packaging:
        SPRING_BOOT_DEFAULTS.packaging,

      javaVersion:
        SPRING_BOOT_DEFAULTS.javaVersion,

      dependencies:
        SPRING_BOOT_DEFAULTS.dependencies.join(
          ","
        )
    });


  const url =
    `${SPRING_INITIALIZR_URL}?${params.toString()}`;


  console.log(
    "[Spring Initializr] Gerando projeto..."
  );

  console.log(
    `[Spring Initializr] Boot: ${SPRING_BOOT_DEFAULTS.bootVersion}`
  );

  console.log(
    `[Spring Initializr] Java: ${SPRING_BOOT_DEFAULTS.javaVersion}`
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


  /*
   * Não colocamos Accept application/octet-stream.
   *
   * O próprio endpoint starter.zip define
   * que queremos um projeto ZIP.
   */
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
      "O Spring Initializr retornou um arquivo ZIP vazio."
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
      "O Spring Initializr respondeu, mas não foi possível interpretar o projeto ZIP gerado."
    );
  }


  const normalizedFiles =
    stripBaseDirectory(
      parsedFiles,
      artifactId
    );


  const files =
    filterGeneratedFiles(
      normalizedFiles
    );


  /*
   * Validação mínima para garantir
   * que recebemos realmente um
   * projeto Maven Spring.
   */
  if (
    !files.some(
      (file) =>
        file.path ===
        "pom.xml"
    )
  ) {
    console.error(
      "[Spring Initializr] Arquivos:",
      files.map(
        (file) =>
          file.path
      )
    );

    throw new Error(
      "O Spring Initializr não retornou um projeto Maven válido: pom.xml não encontrado."
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
      "O Spring Initializr não retornou a estrutura src/main/java esperada."
    );
  }


  console.log(
    `[Spring Initializr] ${files.length} arquivos preparados.`
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