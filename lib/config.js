function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export function getConfig() {
  return {
    githubAppId: required("GITHUB_APP_ID"),
    githubClientId: required("GITHUB_CLIENT_ID"),
    githubClientSecret: required("GITHUB_CLIENT_SECRET"),
    githubPrivateKey: required("GITHUB_PRIVATE_KEY").replace(/\\n/g, "\n"),
    githubOrg: process.env.GITHUB_ORG || "EcoCiente-Instituto-J-F",
    templateOwner: process.env.GITHUB_TEMPLATE_OWNER || "EcoCiente-Instituto-J-F",
    templateRepo: process.env.GITHUB_TEMPLATE_REPO || "ecociente-repo-template",
    installationId: process.env.GITHUB_INSTALLATION_ID || "",
    frontendUrl: required("FRONTEND_URL").replace(/\/$/, ""),
    backendUrl: required("BACKEND_URL").replace(/\/$/, ""),
    sessionSecret: required("SESSION_SECRET")
  };
}
