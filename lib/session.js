import jwt from "jsonwebtoken";
import { getConfig } from "./config.js";

const SESSION_DURATION = "7d";

export function signOAuthState() {
  const { sessionSecret } = getConfig();

  return jwt.sign(
    {
      type: "github-oauth-state"
    },
    sessionSecret,
    {
      expiresIn: "10m",
      issuer: "ecociente-repo-creator"
    }
  );
}

export function verifyOAuthState(token) {
  const { sessionSecret } = getConfig();
  const payload = jwt.verify(token, sessionSecret, {
    issuer: "ecociente-repo-creator"
  });

  if (payload.type !== "github-oauth-state") {
    throw new Error("State OAuth inválido.");
  }

  return payload;
}

export function signUserSession(user) {
  const { sessionSecret, githubOrg } = getConfig();

  return jwt.sign(
    {
      type: "user-session",
      login: user.login,
      org: githubOrg
    },
    sessionSecret,
    {
      subject: String(user.id),
      expiresIn: SESSION_DURATION,
      issuer: "ecociente-repo-creator"
    }
  );
}

export function verifyUserSession(token) {
  const { sessionSecret, githubOrg } = getConfig();

  const payload = jwt.verify(token, sessionSecret, {
    issuer: "ecociente-repo-creator"
  });

  if (
    payload.type !== "user-session" ||
    payload.org !== githubOrg ||
    !payload.login
  ) {
    throw new Error("Sessão inválida.");
  }

  return payload;
}

export function getBearerToken(req) {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new Error("Token de sessão ausente.");
  }

  return token;
}

export function getSessionFromRequest(req) {
  return verifyUserSession(getBearerToken(req));
}