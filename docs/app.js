(() => {
  const config =
    window.ECOCIENTE_CONFIG || {};

  const API_BASE_URL =
    String(
      config.API_BASE_URL || ""
    ).replace(/\/$/, "");

  const ORGANIZATION =
    config.ORGANIZATION ||
    "EcoCiente-Instituto-J-F";

  const allowedPrefixes = [
    "ds",
    "mobile",
    "dad",
    "ia",
    "md",
    "bi",
    "devops",
    "bd",
    "eqs",
    "ux"
  ];

  const repoNameRegex =
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  const springGroupIdRegex =
    /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;

  const springPackageNameRegex =
    /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*$/;

  const SPRING_BOOT_VERSION = "4.1.0";
  const SPRING_JAVA_VERSION = "19";

  const infoContent = {
    name: {
      title:
        "Padrão de nome dos repositórios",

      html: `
        <p>
          Os repositórios do EcoCiente utilizam,
          preferencialmente, o padrão:
        </p>

        <p>
          <code>&lt;matéria&gt;-&lt;nome-do-repositório&gt;</code>
        </p>

        <p>
          Exemplo:
        </p>

        <p>
          <code>ds-cadastro-api</code>
        </p>

        <p>
          O prefixo identifica rapidamente a área ou
          matéria relacionada ao repositório.
        </p>

        <p>
          <strong>Prefixos utilizados:</strong>
        </p>

        <ul>
          <li><code>ds</code> — Desenvolvimento de Sistemas</li>
          <li><code>mobile</code> — Desenvolvimento Mobile</li>
          <li><code>dad</code> — Desenvolvimento e Análise de Dados</li>
          <li><code>ia</code> — Inteligência Artificial</li>
          <li><code>md</code> — Matemática Discreta</li>
          <li><code>bi</code> — Business Intelligence</li>
          <li><code>devops</code> — DevOps</li>
          <li><code>bd</code> — Banco de Dados</li>
          <li><code>eqs</code> — Engenharia e Qualidade de Software</li>
          <li><code>ux</code> — UX / Design</li>
        </ul>

        <p>
          <strong>Importante:</strong>
          o prefixo é recomendado, mas não obrigatório.
        </p>

        <p>
          Caso o repositório não utilize um dos prefixos
          acima, a ferramenta mostrará um aviso, mas ainda
          permitirá sua criação.
        </p>

        <p>
          Independentemente do prefixo, utilize apenas
          letras minúsculas, números e hífens.
        </p>
      `
    },

    visibility: {
      title:
        "Visibilidade e proteção da main",

      html: `
        <p>
          A ferramenta sempre tenta criar automaticamente
          a ruleset <strong>Proteção Main</strong> depois
          que o repositório é criado.
        </p>

        <p>
          Ela é configurada na branch
          <code>main</code> com:
        </p>

        <ul>
          <li>Restrição de exclusão da branch;</li>
          <li>Bloqueio de force push;</li>
          <li>Pull Request obrigatória antes do merge;</li>
          <li>1 aprovação obrigatória;</li>
          <li>Descarte de aprovações antigas quando novos commits forem enviados;</li>
          <li>Resolução de todas as conversas antes do merge;</li>
          <li>Merge, Squash e Rebase permitidos.</li>
        </ul>

        <p>
          Em repositórios privados, a disponibilidade da
          ruleset depende do plano e das políticas atuais
          da organização.
        </p>

        <p>
          Se o GitHub não permitir a aplicação da regra,
          o repositório continuará sendo criado normalmente.
        </p>

        <p>
          Para qualquer dúvida, contate o
          <strong>Mestre DevOps Julio</strong>.
        </p>
      `
    }
  };

  const state = {
    sessionToken:
      localStorage.getItem(
        "ecociente_session"
      ) || "",

    userLogin:
      localStorage.getItem(
        "ecociente_login"
      ) || "",

    authenticated:
      false,

    pendingPayload:
      null,

    creating:
      false
  };

  const els = {
    authArea:
      document.getElementById("authArea"),

    authNotice:
      document.getElementById("authNotice"),

    userStatus:
      document.getElementById("userStatus"),

    loginButton:
      document.getElementById("loginButton"),

    logoutButton:
      document.getElementById("logoutButton"),

    form:
      document.getElementById("repoForm"),

    repoName:
      document.getElementById("repoName"),

    repoDescription:
      document.getElementById("repoDescription"),

    descriptionCounter:
      document.getElementById("descriptionCounter"),

    nameError:
      document.getElementById("nameError"),

    nameWarning:
      document.getElementById("nameWarning"),

    descriptionError:
      document.getElementById("descriptionError"),

    springBootConfig:
      document.getElementById("springBootConfig"),

    springGroupId:
      document.getElementById("springGroupId"),

    springArtifactId:
      document.getElementById("springArtifactId"),

    springPackageName:
      document.getElementById("springPackageName"),

    springGroupIdError:
      document.getElementById("springGroupIdError"),

    springArtifactIdError:
      document.getElementById("springArtifactIdError"),

    springPackageNameError:
      document.getElementById("springPackageNameError"),

    privateWarning:
      document.getElementById("privateWarning"),

    rulesetSummaryLine:
      document.getElementById("rulesetSummaryLine"),

    createButton:
      document.getElementById("createButton"),

    infoModal:
      document.getElementById("infoModal"),

    infoModalTitle:
      document.getElementById("infoModalTitle"),

    infoModalContent:
      document.getElementById("infoModalContent"),

    confirmModal:
      document.getElementById("confirmModal"),

    confirmName:
      document.getElementById("confirmName"),

    confirmPrefix:
      document.getElementById("confirmPrefix"),

    confirmPrefixWarning:
      document.getElementById("confirmPrefixWarning"),

    confirmDescription:
      document.getElementById("confirmDescription"),

    confirmVisibility:
      document.getElementById("confirmVisibility"),

    confirmSpringRow:
      document.getElementById("confirmSpringRow"),

    confirmSpringBoot:
      document.getElementById("confirmSpringBoot"),

    confirmSpringDetails:
      document.getElementById("confirmSpringDetails"),

    confirmSpringConfig:
      document.getElementById("confirmSpringConfig"),

    confirmRuleset:
      document.getElementById("confirmRuleset"),

    confirmPrivateWarning:
      document.getElementById("confirmPrivateWarning"),

    confirmCreateButton:
      document.getElementById("confirmCreateButton"),

    resultModal:
      document.getElementById("resultModal"),

    resultBadge:
      document.getElementById("resultBadge"),

    resultModalTitle:
      document.getElementById("resultModalTitle"),

    resultMessage:
      document.getElementById("resultMessage"),

    resultDetails:
      document.getElementById("resultDetails"),

    resultCloseButton:
      document.getElementById("resultCloseButton"),

    repoLinkButton:
      document.getElementById("repoLinkButton")
  };

  function selectedVisibility() {
    return (
      document.querySelector(
        'input[name="visibility"]:checked'
      )?.value ||
      "public"
    );
  }

  function springBootEnabled() {
    return (
      document.querySelector(
        'input[name="springBoot"]:checked'
      )?.value === "yes"
    );
  }

  function normalizeRepoName(value) {
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

  function normalizeArtifactId(value) {
    return normalizeRepoName(value);
  }

  function buildPackageName(
    groupId,
    artifactId
  ) {
    const cleanGroup =
      String(groupId || "")
        .trim()
        .toLowerCase();

    const artifactPackage =
      String(artifactId || "")
        .trim()
        .toLowerCase()
        .replace(
          /[^a-z0-9_]/g,
          ""
        );

    if (!cleanGroup) {
      return artifactPackage;
    }

    if (!artifactPackage) {
      return cleanGroup;
    }

    return `${cleanGroup}.${artifactPackage}`;
  }

  function updateSpringDerivedFields() {
    if (!springBootEnabled()) {
      return;
    }

    if (
      !els.springArtifactId.dataset.manual
    ) {
      els.springArtifactId.value =
        normalizeArtifactId(
          els.repoName.value
        );
    }

    if (
      !els.springPackageName.dataset.manual
    ) {
      els.springPackageName.value =
        buildPackageName(
          els.springGroupId.value,
          els.springArtifactId.value
        );
    }
  }

  function updateSpringUI() {
    const enabled =
      springBootEnabled();

    els.springBootConfig.classList.toggle(
      "hidden",
      !enabled
    );

    if (enabled) {
      updateSpringDerivedFields();
    } else {
      els.springGroupIdError.textContent =
        "";

      els.springArtifactIdError.textContent =
        "";

      els.springPackageNameError.textContent =
        "";
    }
  }

  function validateSpringConfig() {
    if (!springBootEnabled()) {
      return true;
    }

    const groupId =
      els.springGroupId.value
        .trim()
        .toLowerCase();

    const artifactId =
      normalizeArtifactId(
        els.springArtifactId.value
      );

    const packageName =
      els.springPackageName.value
        .trim()
        .toLowerCase();

    els.springArtifactId.value =
      artifactId;

    let valid = true;

    if (
      !springGroupIdRegex.test(
        groupId
      )
    ) {
      els.springGroupIdError.textContent =
        "Use um Group ID como com.example ou br.com.ecociente.";

      valid = false;
    } else {
      els.springGroupIdError.textContent =
        "";
    }

    if (
      !artifactId ||
      !repoNameRegex.test(
        artifactId
      )
    ) {
      els.springArtifactIdError.textContent =
        "Use apenas letras minúsculas, números e hífens.";

      valid = false;
    } else {
      els.springArtifactIdError.textContent =
        "";
    }

    if (
      !springPackageNameRegex.test(
        packageName
      )
    ) {
      els.springPackageNameError.textContent =
        "Use um package Java como com.example.demo.";

      valid = false;
    } else {
      els.springPackageNameError.textContent =
        "";
    }

    return valid;
  }

  function usesRecommendedPrefix(
    repoName
  ) {
    return allowedPrefixes.some(
      (prefix) =>
        repoName.startsWith(
          `${prefix}-`
        )
    );
  }

  function getRepoPrefix(
    repoName
  ) {
    return (
      allowedPrefixes.find(
        (prefix) =>
          repoName.startsWith(
            `${prefix}-`
          )
      ) ||
      null
    );
  }

  function openModal(
    modal
  ) {
    modal.classList.remove(
      "hidden"
    );

    document.body.classList.add(
      "modal-open"
    );
  }

  function closeModal(
    modal
  ) {
    modal.classList.add(
      "hidden"
    );

    if (
      [
        els.infoModal,
        els.confirmModal,
        els.resultModal
      ].every(
        (item) =>
          item.classList.contains(
            "hidden"
          )
      )
    ) {
      document.body.classList.remove(
        "modal-open"
      );
    }
  }

  function updateVisibilityUI() {
    const isPrivate =
      selectedVisibility() ===
      "private";

    els.privateWarning.classList.toggle(
      "hidden",
      !isPrivate
    );

    els.rulesetSummaryLine.innerHTML =
      isPrivate
        ? 'Ruleset: <strong>Proteção Main — será tentada automaticamente</strong>'
        : 'Ruleset: <strong>Proteção Main</strong>';
  }

  function updatePrefixWarning() {
    const value =
      normalizeRepoName(
        els.repoName.value
      );

    if (
      !value ||
      usesRecommendedPrefix(
        value
      )
    ) {
      els.nameWarning.textContent =
        "";

      els.nameWarning.classList.add(
        "hidden"
      );

      return;
    }

    els.nameWarning.textContent =
      "⚠ Este nome não utiliza um dos prefixos recomendados pelo padrão EcoCiente. Você ainda poderá criar o repositório.";

    els.nameWarning.classList.remove(
      "hidden"
    );
  }

  function validateName() {
    const value =
      normalizeRepoName(
        els.repoName.value
      );

    els.repoName.value =
      value;

    if (!value) {
      els.nameError.textContent =
        "Informe o nome do repositório.";

      updatePrefixWarning();

      return false;
    }

    if (
      value.length > 100 ||
      !repoNameRegex.test(value)
    ) {
      els.nameError.textContent =
        "Use apenas letras minúsculas, números e hífens.";

      updatePrefixWarning();

      return false;
    }

    els.nameError.textContent =
      "";

    updatePrefixWarning();

    return true;
  }

  function validateDescription() {
    const value =
      els.repoDescription.value.trim();

    if (!value) {
      els.descriptionError.textContent =
        "Informe uma descrição para o repositório.";

      return false;
    }

    if (
      value.length > 350
    ) {
      els.descriptionError.textContent =
        "A descrição deve ter no máximo 350 caracteres.";

      return false;
    }

    els.descriptionError.textContent =
      "";

    return true;
  }

  function updateDescriptionCounter() {
    els.descriptionCounter.textContent =
      `${els.repoDescription.value.length}/350`;
  }

  function validateForm() {
    const baseValid =
      validateName() &&
      validateDescription();

    const springValid =
      validateSpringConfig();

    return (
      baseValid &&
      springValid
    );
  }

  function updateAuthUI() {
    if (
      state.authenticated
    ) {
      els.userStatus.textContent =
        `@${state.userLogin} · ${ORGANIZATION}`;

      els.loginButton.classList.add(
        "hidden"
      );

      els.logoutButton.classList.remove(
        "hidden"
      );

      els.authNotice.classList.add(
        "hidden"
      );

      els.createButton.disabled =
        false;
    } else {
      els.userStatus.textContent =
        "Não autenticado";

      els.loginButton.classList.remove(
        "hidden"
      );

      els.logoutButton.classList.add(
        "hidden"
      );

      els.authNotice.classList.remove(
        "hidden"
      );

      els.createButton.disabled =
        true;
    }
  }

  function clearSession() {
    state.sessionToken =
      "";

    state.userLogin =
      "";

    state.authenticated =
      false;

    localStorage.removeItem(
      "ecociente_session"
    );

    localStorage.removeItem(
      "ecociente_login"
    );

    updateAuthUI();
  }

  function readAuthFromHash() {
    const hash =
      window.location.hash.startsWith(
        "#"
      )
        ? window.location.hash.slice(
            1
          )
        : "";

    if (!hash) {
      return;
    }

    const params =
      new URLSearchParams(hash);

    const token =
      params.get(
        "session"
      );

    const login =
      params.get(
        "login"
      );

    const error =
      params.get(
        "error"
      );

    if (token) {
      state.sessionToken =
        token;

      state.userLogin =
        login ||
        "membro";

      localStorage.setItem(
        "ecociente_session",
        token
      );

      localStorage.setItem(
        "ecociente_login",
        state.userLogin
      );
    }

    history.replaceState(
      null,
      "",
      window.location.pathname +
        window.location.search
    );

    if (error) {
      showResult({
        success:
          false,

        title:
          "Não foi possível entrar",

        message:
          decodeURIComponent(
            error
          )
      });
    }
  }

  async function verifySession() {
    if (
      !state.sessionToken ||
      !API_BASE_URL ||
      API_BASE_URL.includes(
        "SEU-BACKEND"
      )
    ) {
      state.authenticated =
        false;

      updateAuthUI();

      return;
    }

    try {
      const response =
        await fetch(
          `${API_BASE_URL}/api/auth/me`,
          {
            headers: {
              Authorization:
                `Bearer ${state.sessionToken}`
            }
          }
        );

      if (!response.ok) {
        throw new Error(
          "Sessão inválida"
        );
      }

      const data =
        await response.json();

      state.authenticated =
        true;

      state.userLogin =
        data.login;

      localStorage.setItem(
        "ecociente_login",
        data.login
      );
    } catch {
      clearSession();
    }

    updateAuthUI();
  }

  function showInfo(
    type
  ) {
    const content =
      infoContent[type];

    if (!content) {
      return;
    }

    els.infoModalTitle.textContent =
      content.title;

    els.infoModalContent.innerHTML =
      content.html;

    openModal(
      els.infoModal
    );
  }

  function showConfirmation(
    payload
  ) {
    const isPrivate =
      payload.visibility ===
      "private";

    const prefix =
      getRepoPrefix(
        payload.name
      );

    els.confirmName.textContent =
      payload.name;

    els.confirmDescription.textContent =
      payload.description;

    els.confirmVisibility.textContent =
      isPrivate
        ? "Privado"
        : "Público";

    const isSpringBoot =
      payload.springBoot?.enabled ===
      true;

    els.confirmSpringBoot.textContent =
      isSpringBoot
        ? "Sim"
        : "Não";

    els.confirmSpringDetails.classList.toggle(
      "hidden",
      !isSpringBoot
    );

    els.confirmSpringConfig.textContent =
      isSpringBoot
        ? [
            `Spring Boot ${SPRING_BOOT_VERSION}`,
            "Linguagem: Java",
            `Group ID: ${payload.springBoot.groupId}`,
            `Artifact ID: ${payload.springBoot.artifactId}`,
            `Package: ${payload.springBoot.packageName}`,
            "Build: Gradle",
            "Packaging: Jar",
            `Java: ${SPRING_JAVA_VERSION}`,
            "DevOps: CI, Docker, Docker Compose e Kubernetes",
            "Dependências: Lombok, Spring Boot DevTools e Spring Web"
          ].join("\n")
        : "";

    if (prefix) {
      els.confirmPrefix.textContent =
        `Sim — prefixo "${prefix}" reconhecido`;

      els.confirmPrefixWarning.classList.add(
        "hidden"
      );

      els.confirmPrefixWarning.innerHTML =
        "";
    } else {
      els.confirmPrefix.textContent =
        "Não utiliza prefixo recomendado";

      els.confirmPrefixWarning.innerHTML =
        `
          <strong>Atenção:</strong>
          o nome informado não utiliza um dos prefixos
          recomendados pelo padrão EcoCiente.

          O repositório ainda poderá ser criado normalmente.

          Caso queira seguir o padrão, utilize algo como
          <code>ds-${payload.name}</code>.
        `;

      els.confirmPrefixWarning.classList.remove(
        "hidden"
      );
    }

    els.confirmRuleset.textContent =
      isPrivate
        ? "Proteção Main — aplicação será tentada"
        : "Proteção Main";

    els.confirmPrivateWarning.classList.toggle(
      "hidden",
      !isPrivate
    );

    els.confirmPrivateWarning.innerHTML =
      isPrivate
        ? `
          <strong>Atenção:</strong>
          a ferramenta tentará aplicar a
          <strong>Proteção Main</strong>,
          mas a disponibilidade em repositórios privados
          depende do plano e das políticas da organização.

          Se o GitHub não permitir, o repositório será
          criado normalmente e você receberá um aviso.

          Em caso de dúvida, contate o
          <strong>Mestre DevOps Julio</strong>.
        `
        : "";

    state.pendingPayload =
      payload;

    openModal(
      els.confirmModal
    );
  }

  function setCreating(
    value
  ) {
    state.creating =
      value;

    els.confirmCreateButton.disabled =
      value;

    els.confirmCreateButton.textContent =
      value
        ? "Criando..."
        : "Confirmar e criar";
  }

  function showResult({
    success,
    title,
    message,
    details = [],
    repoUrl = ""
  }) {
    els.resultBadge.className =
      `result-badge ${
        success
          ? "success"
          : "error"
      }`;

    els.resultBadge.textContent =
      success
        ? "✓"
        : "!";

    els.resultModalTitle.textContent =
      title;

    els.resultMessage.textContent =
      message;

    els.resultDetails.innerHTML =
      "";

    details.forEach(
      (detail) => {
        const item =
          document.createElement(
            "div"
          );

        item.className =
          "result-item";

        item.innerHTML =
          detail;

        els.resultDetails.appendChild(
          item
        );
      }
    );

    if (repoUrl) {
      els.repoLinkButton.href =
        repoUrl;

      els.repoLinkButton.classList.remove(
        "hidden"
      );
    } else {
      els.repoLinkButton.classList.add(
        "hidden"
      );

      els.repoLinkButton.href =
        "#";
    }

    openModal(
      els.resultModal
    );
  }

  async function createRepository() {
    if (
      !state.pendingPayload ||
      state.creating
    ) {
      return;
    }

    setCreating(
      true
    );

    try {
      const response =
        await fetch(
          `${API_BASE_URL}/api/repositories/create`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${state.sessionToken}`
            },

            body:
              JSON.stringify(
                state.pendingPayload
              )
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        clearSession();
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Não foi possível criar o repositório."
        );
      }

      closeModal(
        els.confirmModal
      );

      els.form.reset();

      document.getElementById(
        "visibilityPublic"
      ).checked =
        true;

      document.getElementById(
        "springBootNo"
      ).checked =
        true;

      els.springGroupId.value =
        "com.example";

      els.springArtifactId.value =
        "";

      els.springArtifactId.dataset.manual =
        "";

      els.springPackageName.value =
        "";

      els.springPackageName.dataset.manual =
        "";

      els.nameWarning.textContent =
        "";

      els.nameWarning.classList.add(
        "hidden"
      );

      updateDescriptionCounter();
      updateVisibilityUI();
      updateSpringUI();

      const prefix =
        getRepoPrefix(
          data.repository.name
        );

      const details = [
        `<strong>Repositório:</strong> ${data.repository.fullName}`,

        prefix
          ? `<strong>Padrão de nome:</strong> prefixo "${prefix}" reconhecido`
          : `<strong>Padrão de nome:</strong> criado sem prefixo recomendado`,

        `<strong>Template:</strong> ${data.template}`,

        `<strong>Automação de PR:</strong> herdada do template`,

        `<strong>Licença:</strong> MIT License herdada do template`,

        `<strong>.gitignore:</strong> não incluído pelo template`,

        data.springBoot?.requested
          ? data.springBoot.configured
          ? `<strong>Spring Boot:</strong> ${data.springBoot.config.bootVersion}, Java ${data.springBoot.config.javaVersion}, Gradle/Jar — configurado com sucesso`            : `<strong>Spring Boot:</strong> solicitado, mas não foi possível concluir — ${data.springBoot.reason || "verifique os avisos"}`
          : `<strong>Spring Boot:</strong> não solicitado`,

        data.ruleset.applied
          ? `<strong>Proteção Main:</strong> aplicada com sucesso`
          : `<strong>Proteção Main:</strong> não aplicada — ${
              data.ruleset.reason ||
              "verifique as permissões ou o plano da organização"
            }`
      ];

      if (
        Array.isArray(
          data.warnings
        )
      ) {
        data.warnings.forEach(
          (warning) => {
            details.push(
              `<strong>Aviso:</strong> ${warning}`
            );
          }
        );
      }

      showResult({
        success:
          true,

        title:
          "Repositório criado!",

        message:
          data.ruleset.applied
            ? "O repositório foi criado a partir do template EcoCiente e a Proteção Main foi aplicada."
            : "O repositório foi criado a partir do template EcoCiente. Confira o aviso sobre a Proteção Main abaixo.",

        details,

        repoUrl:
          data.repository.url
      });
    } catch (
      error
    ) {
      showResult({
        success:
          false,

        title:
          "Erro ao criar repositório",

        message:
          error.message ||
          "Ocorreu um erro inesperado."
      });
    } finally {
      setCreating(
        false
      );
    }
  }

  els.loginButton.addEventListener(
    "click",
    () => {
      if (
        !API_BASE_URL ||
        API_BASE_URL.includes(
          "SEU-BACKEND"
        )
      ) {
        showResult({
          success:
            false,

          title:
            "Backend não configurado",

          message:
            "Edite docs/config.js e informe a URL pública do backend antes de usar o login."
        });

        return;
      }

      window.location.href =
        `${API_BASE_URL}/api/auth/start`;
    }
  );

  els.logoutButton.addEventListener(
    "click",
    clearSession
  );

  els.repoName.addEventListener(
    "input",
    () => {
      updatePrefixWarning();
      updateSpringDerivedFields();

      if (
        els.nameError.textContent
      ) {
        validateName();
      }
    }
  );

  els.repoName.addEventListener(
    "blur",
    validateName
  );

  els.repoDescription.addEventListener(
    "input",
    () => {
      updateDescriptionCounter();

      if (
        els.descriptionError.textContent
      ) {
        validateDescription();
      }
    }
  );

  els.repoDescription.addEventListener(
    "blur",
    validateDescription
  );

  document
    .querySelectorAll(
      'input[name="visibility"]'
    )
    .forEach(
      (input) => {
        input.addEventListener(
          "change",
          updateVisibilityUI
        );
      }
    );

  document
    .querySelectorAll(
      'input[name="springBoot"]'
    )
    .forEach(
      (input) => {
        input.addEventListener(
          "change",
          updateSpringUI
        );
      }
    );

  els.springGroupId.addEventListener(
    "input",
    () => {
      els.springGroupId.value =
        els.springGroupId.value.toLowerCase();

      if (
        !els.springPackageName.dataset.manual
      ) {
        els.springPackageName.value =
          buildPackageName(
            els.springGroupId.value,
            els.springArtifactId.value
          );
      }

      if (
        els.springGroupIdError.textContent
      ) {
        validateSpringConfig();
      }
    }
  );

  els.springArtifactId.addEventListener(
    "input",
    () => {
      els.springArtifactId.dataset.manual =
        "true";

      els.springArtifactId.value =
        normalizeArtifactId(
          els.springArtifactId.value
        );

      if (
        !els.springPackageName.dataset.manual
      ) {
        els.springPackageName.value =
          buildPackageName(
            els.springGroupId.value,
            els.springArtifactId.value
          );
      }

      if (
        els.springArtifactIdError.textContent
      ) {
        validateSpringConfig();
      }
    }
  );

  els.springPackageName.addEventListener(
    "input",
    () => {
      els.springPackageName.dataset.manual =
        "true";

      els.springPackageName.value =
        els.springPackageName.value.toLowerCase();

      if (
        els.springPackageNameError.textContent
      ) {
        validateSpringConfig();
      }
    }
  );

  document
    .querySelectorAll(
      ".info-button"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () =>
            showInfo(
              button.dataset.info
            )
        );
      }
    );

  document
    .querySelectorAll(
      '[data-close-modal="info"]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () =>
            closeModal(
              els.infoModal
            )
        );
      }
    );

  document
    .querySelectorAll(
      '[data-close-modal="confirm"]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            if (
              !state.creating
            ) {
              closeModal(
                els.confirmModal
              );
            }
          }
        );
      }
    );

  els.resultCloseButton.addEventListener(
    "click",
    () =>
      closeModal(
        els.resultModal
      )
  );

  els.form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      if (
        !state.authenticated
      ) {
        showResult({
          success:
            false,

          title:
            "Entre com o GitHub",

          message:
            "Você precisa estar autenticado como membro da organização antes de criar um repositório."
        });

        return;
      }

      if (
        !validateForm()
      ) {
        return;
      }

      showConfirmation({
        name:
          normalizeRepoName(
            els.repoName.value
          ),

        description:
          els.repoDescription.value.trim(),

        visibility:
          selectedVisibility(),

        springBoot:
          springBootEnabled()
            ? {
                enabled:
                  true,

                groupId:
                  els.springGroupId.value
                    .trim()
                    .toLowerCase(),

                artifactId:
                  normalizeArtifactId(
                    els.springArtifactId.value
                  ),

                packageName:
                  els.springPackageName.value
                    .trim()
                    .toLowerCase()
              }
            : {
                enabled:
                  false
              }
      });
    }
  );

  els.confirmCreateButton.addEventListener(
    "click",
    createRepository
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key !==
          "Escape" ||
        state.creating
      ) {
        return;
      }

      if (
        !els.infoModal.classList.contains(
          "hidden"
        )
      ) {
        closeModal(
          els.infoModal
        );
      } else if (
        !els.confirmModal.classList.contains(
          "hidden"
        )
      ) {
        closeModal(
          els.confirmModal
        );
      } else if (
        !els.resultModal.classList.contains(
          "hidden"
        )
      ) {
        closeModal(
          els.resultModal
        );
      }
    }
  );

  readAuthFromHash();

  updateDescriptionCounter();

  updateVisibilityUI();

  updateSpringUI();

  updateAuthUI();

  verifySession();
})();