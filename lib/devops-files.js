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


function normalizeKubernetesName(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9-]/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    )
    .replace(
      /^-|-$/g,
      ""
    )
    .slice(
      0,
      48
    )
    .replace(
      /-$/,
      ""
    );
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

# Kubernetes local secrets
k8s/secret.yaml

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

k8s

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
    `
  );
}


function createNamespace() {
  return textFile(
    "k8s/namespace.yaml",
    `
apiVersion: v1
kind: Namespace

metadata:
  name: ecociente
    `
  );
}


function createConfigMap(
  kubernetesName
) {
  return textFile(
    "k8s/configmap.yaml",
    `
apiVersion: v1
kind: ConfigMap

metadata:
  name: ${kubernetesName}-config
  namespace: ecociente

data:
  SERVER_PORT: "8080"
    `
  );
}


function createDeployment(
  artifactId,
  kubernetesName
) {
  return textFile(
    "k8s/api-deployment.yaml",
    `
apiVersion: apps/v1
kind: Deployment

metadata:
  name: ${kubernetesName}
  namespace: ecociente

spec:
  replicas: 2

  selector:
    matchLabels:
      app: ${kubernetesName}

  template:
    metadata:
      labels:
        app: ${kubernetesName}

    spec:
      containers:

        - name: ${kubernetesName}

          image: ecociente/ecociente:${artifactId}-1.0.0
          imagePullPolicy: Always

          ports:
            - containerPort: 8080

          envFrom:
            - configMapRef:
                name: ${kubernetesName}-config

          startupProbe:
            tcpSocket:
              port: 8080

            periodSeconds: 5
            failureThreshold: 30

          readinessProbe:
            tcpSocket:
              port: 8080

            periodSeconds: 10
            failureThreshold: 3

          livenessProbe:
            tcpSocket:
              port: 8080

            periodSeconds: 20
            failureThreshold: 3

          resources:

            requests:
              cpu: "100m"
              memory: "256Mi"

            limits:
              cpu: "500m"
              memory: "512Mi"
    `
  );
}


function createService(
  kubernetesName
) {
  return textFile(
    "k8s/api-service.yaml",
    `
apiVersion: v1
kind: Service

metadata:
  name: ${kubernetesName}-service
  namespace: ecociente

spec:
  selector:
    app: ${kubernetesName}

  ports:

    - protocol: TCP
      port: 8080
      targetPort: 8080

  type: ClusterIP
    `
  );
}


export function generateDevOpsFiles({
  artifactId
}) {
  const kubernetesName =
    normalizeKubernetesName(
      artifactId
    );

  if (!kubernetesName) {
    throw new Error(
      "Não foi possível gerar um nome válido para os recursos Kubernetes."
    );
  }

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
    ),

    createNamespace(),

    createConfigMap(
      kubernetesName
    ),

    createDeployment(
      artifactId,
      kubernetesName
    ),

    createService(
      kubernetesName
    )
  ];
}