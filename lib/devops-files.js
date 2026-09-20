function normalizeContent(content) {
  const lines = String(content || "")
    .replace(/\r\n/g, "\n")
    .split("\n");

  while (
    lines.length > 0 &&
    lines[0].trim() === ""
  ) {
    lines.shift();
  }

  while (
    lines.length > 0 &&
    lines[lines.length - 1].trim() === ""
  ) {
    lines.pop();
  }

  const nonEmptyLines =
    lines.filter(
      (line) =>
        line.trim() !== ""
    );

  if (
    nonEmptyLines.length === 0
  ) {
    return "";
  }

  const commonIndent =
    Math.min(
      ...nonEmptyLines.map(
        (line) =>
          line.match(
            /^[ \t]*/
          )[0].length
      )
    );

  return lines
    .map(
      (line) =>
        line.slice(
          commonIndent
        )
    )
    .join("\n");
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
        `${normalizeContent(content)}\n`,
        "utf8"
      )
  };
}


function createDockerfile() {
  return textFile(
    "Dockerfile",
    `
FROM eclipse-temurin:19-jdk-jammy AS build

WORKDIR /app

COPY gradlew gradlew.bat build.gradle settings.gradle ./
COPY gradle ./gradle

RUN sed -i 's/\\r$//' gradlew && chmod +x gradlew

COPY src ./src

RUN ./gradlew clean bootJar -x test --no-daemon

RUN JAR_FILE="$(find build/libs -maxdepth 1 -type f -name '*.jar' ! -name '*-plain.jar' | head -n 1)" \\
    && test -n "$JAR_FILE" \\
    && cp "$JAR_FILE" app.jar


FROM eclipse-temurin:19-jre-jammy

WORKDIR /app

RUN groupadd --system spring && \\
    useradd --system --gid spring spring

COPY --from=build /app/app.jar app.jar

USER spring:spring

EXPOSE 8080

ENV SERVER_PORT=8080

ENTRYPOINT ["java", "-jar", "app.jar"]
    `
  );
}


function createGitIgnore() {
  return textFile(
    ".gitignore",
    `
# Gradle
.gradle/
build/
bin/
out/

# IDE
.idea/
.vscode/
*.iml

# Environment
.env
.env.*
!.env.example

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db
    `
  );
}


function createDockerIgnore() {
  return textFile(
    ".dockerignore",
    `
.git
.github

.gradle
build
bin
out
target

.idea
.vscode
*.iml

*.log
logs

.env
.env.*

docker-compose.yml
docker-compose.yaml
compose.yml
compose.yaml

README.md
HELP.md
LICENSE
LICENSE.md
    `
  );
}


function createDockerCompose(
  artifactId
) {
  return textFile(
    "docker-compose.yml",
    `
services:

  ${artifactId}:
    build:
      context: .
      dockerfile: Dockerfile

    image: ${artifactId}:1.0.0
    container_name: ${artifactId}

    ports:
      - "\${APP_PORT:-8080}:8080"

    environment:
      SERVER_PORT: "8080"

    restart: unless-stopped
    `
  );
}


function createEnvExample() {
  return textFile(
    ".env.example",
    `
APP_PORT=8080
    `
  );
}


function createCiWorkflow(
  artifactId
) {
  return textFile(
    ".github/workflows/ci.yml",
    `
name: CI - ${artifactId}

on:
  pull_request:
    branches:
      - main

  push:
    branches:
      - main

permissions:
  contents: read

concurrency:
  group: ci-\${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:

  build-and-test:

    name: Build e testes

    runs-on: ubuntu-latest

    timeout-minutes: 15

    steps:

      - name: Baixar codigo
        uses: actions/checkout@v7

      - name: Configurar Java 19
        uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: "19"

      - name: Configurar Gradle
        uses: gradle/actions/setup-gradle@v6

      - name: Dar permissao ao Gradle Wrapper
        run: chmod +x gradlew

      - name: Executar build e testes
        run: ./gradlew clean build --no-daemon


  publish-image:

    name: Publicar imagem Docker

    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    needs:
      - build-and-test

    runs-on: ubuntu-latest

    timeout-minutes: 20

    outputs:
      app_name: \${{ steps.image.outputs.app_name }}
      version: \${{ steps.image.outputs.version }}
      image_tag: \${{ steps.image.outputs.image_tag }}
      image: \${{ steps.image.outputs.image }}

    steps:

      - name: Baixar codigo
        uses: actions/checkout@v7

      - name: Preparar metadados da imagem
        id: image
        shell: bash
        run: |
          set -euo pipefail

          REPO_NAME="\${GITHUB_REPOSITORY##*/}"

          APP_NAME="\${REPO_NAME#ds-}"
          APP_NAME="\${APP_NAME%-api}"

          APP_NAME="$(
            printf '%s' "$APP_NAME" |
            tr '[:upper:]_' '[:lower:]-' |
            sed -E 's/[^a-z0-9-]+/-/g; s/^-+|-+$//g'
          )"

          if [ -z "$APP_NAME" ]; then
            echo "::error::Nao foi possivel derivar o nome curto da aplicacao."
            exit 1
          fi

          VERSION="$(
            awk -F"'" '/^version = / { print $2; exit }' build.gradle
          )"

          if [ -z "$VERSION" ]; then
            echo "::error::Nao foi possivel localizar a versao no build.gradle."
            exit 1
          fi

          if ! [[ "$VERSION" =~ ^[0-9]+[.][0-9]+[.][0-9]+$ ]]; then
            echo "::error::Versao invalida no build.gradle: $VERSION"
            echo "::error::Use o formato numerico MAJOR.MINOR.PATCH, por exemplo 1.0.0."
            exit 1
          fi

          IMAGE_TAG="$APP_NAME-$VERSION"
          IMAGE="ecociente/ecociente:$IMAGE_TAG"

          {
            echo "app_name=$APP_NAME"
            echo "version=$VERSION"
            echo "image_tag=$IMAGE_TAG"
            echo "image=$IMAGE"
          } >> "$GITHUB_OUTPUT"

          echo "Aplicacao: $APP_NAME"
          echo "Versao: $VERSION"
          echo "Imagem: $IMAGE"

      - name: Configurar Docker Buildx
        uses: docker/setup-buildx-action@v4

      - name: Login no Docker Hub
        uses: docker/login-action@v4
        with:
          username: \${{ secrets.DOCKERHUB_USERNAME }}
          password: \${{ secrets.DOCKERHUB_TOKEN }}

      - name: Verificar imutabilidade da tag
        shell: bash
        env:
          IMAGE: \${{ steps.image.outputs.image }}
        run: |
          set -euo pipefail

          set +e

          OUTPUT="$(
            docker buildx imagetools inspect "$IMAGE" 2>&1
          )"

          STATUS=$?

          set -e

          if [ "$STATUS" -eq 0 ]; then
            echo "::error::A imagem $IMAGE ja existe no Docker Hub."
            echo "::error::Tags publicadas pelo EcoCiente sao imutaveis."
            echo "::error::Atualize a versao no build.gradle antes de publicar novamente."
            exit 1
          fi

          if echo "$OUTPUT" |
            grep -Eqi 'not found|manifest unknown|no such manifest'
          then
            echo "Tag disponivel: $IMAGE"
            exit 0
          fi

          echo "$OUTPUT"

          echo "::error::Nao foi possivel confirmar se a tag $IMAGE esta disponivel."
          exit 1

      - name: Construir e publicar imagem
        uses: docker/build-push-action@v7
        with:
          context: .
          push: true
          platforms: linux/amd64
          tags: \${{ steps.image.outputs.image }}

      - name: Resumo da imagem publicada
        shell: bash
        env:
          IMAGE: \${{ steps.image.outputs.image }}
        run: |
          echo "Imagem publicada com sucesso:"
          echo "$IMAGE"


  update-infrastructure:

    name: Solicitar atualizacao da infraestrutura

    if: github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.publish-image.outputs.version != '1.0.0'

    needs:
      - publish-image

    runs-on: ubuntu-latest

    timeout-minutes: 5

    steps:

      - name: Validar configuracao do CI Dispatcher
        shell: bash
        env:
          APP_ID: \${{ vars.CI_DISPATCHER_APP_ID }}
          PRIVATE_KEY: \${{ secrets.CI_DISPATCHER_PRIVATE_KEY }}
        run: |
          set -euo pipefail

          if [ -z "$APP_ID" ]; then
            echo "::error::CI_DISPATCHER_APP_ID nao esta disponivel."
            exit 1
          fi

          if [ -z "$PRIVATE_KEY" ]; then
            echo "::error::CI_DISPATCHER_PRIVATE_KEY nao esta disponivel."
            exit 1
          fi

          echo "Configuracao do CI Dispatcher disponivel."

      - name: Criar token do CI Dispatcher
        id: infra-token
        uses: actions/create-github-app-token@v3
        with:
          app-id: \${{ vars.CI_DISPATCHER_APP_ID }}
          private-key: \${{ secrets.CI_DISPATCHER_PRIVATE_KEY }}
          owner: EcoCiente-Instituto-J-F
          repositories: devops-infra-ecociente
          permission-actions: write

      - name: Solicitar atualizacao do image.tag
        shell: bash
        env:
          GH_TOKEN: \${{ steps.infra-token.outputs.token }}
          APPLICATION: \${{ needs.publish-image.outputs.app_name }}
          VERSION: \${{ needs.publish-image.outputs.version }}
        run: |
          set -euo pipefail

          echo "Aplicacao: $APPLICATION"
          echo "Versao: $VERSION"

          gh workflow run \\
            update-image-tag.yaml \\
            --repo EcoCiente-Instituto-J-F/devops-infra-ecociente \\
            --ref main \\
            -f application="$APPLICATION" \\
            -f version="$VERSION"

          echo ""
          echo "Atualizacao da infraestrutura solicitada com sucesso."

      - name: Resumo da integracao com infraestrutura
        shell: bash
        env:
          APPLICATION: \${{ needs.publish-image.outputs.app_name }}
          VERSION: \${{ needs.publish-image.outputs.version }}
        run: |
          echo "=========================================="
          echo "EcoCiente - Atualizacao de infraestrutura"
          echo "=========================================="
          echo "Aplicacao: $APPLICATION"
          echo "Versao:    $VERSION"
          echo "Destino:   devops-infra-ecociente"
          echo "Workflow:  update-image-tag.yaml"
          echo "Resultado: dispatch solicitado."
    `
  );
}


export function generateDevOpsFiles({
  artifactId
}) {
  return [
    createDockerfile(),

    createGitIgnore(),

    createDockerIgnore(),

    createDockerCompose(
      artifactId
    ),

    createEnvExample(),

    createCiWorkflow(
      artifactId
    )
  ];
}
