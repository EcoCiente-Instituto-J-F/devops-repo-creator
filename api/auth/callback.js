import { getConfig } from "../../lib/config.js";
import { verifyOAuthState, signUserSession } from "../../lib/session.js";
import {
  exchangeOAuthCode,
  getAuthenticatedUser,
  getAuthenticatedUserMembership
} from "../../lib/github.js";

function redirectError(res, frontendUrl, message) {
  const error = encodeURIComponent(message);
  return res.redirect(302, `${frontendUrl}/#error=${error}`);
}

export default async function handler(req, res) {
  const { frontendUrl } = getConfig();

  if (req.method !== "GET") {
    return redirectError(res, frontendUrl, "Método de autenticação inválido.");
  }

  const { code, state, error, error_description: errorDescription } = req.query;

  if (error) {
    return redirectError(res, frontendUrl, errorDescription || "Autenticação cancelada no GitHub.");
  }

  if (!code || !state) {
    return redirectError(res, frontendUrl, "O GitHub não retornou os dados necessários para autenticar.");
  }

  try {
    verifyOAuthState(state);

    const userToken = await exchangeOAuthCode(code);
    const user = await getAuthenticatedUser(userToken);
    const membership = await getAuthenticatedUserMembership(userToken);

    if (membership?.state !== "active") {
      return redirectError(
        res,
        frontendUrl,
        "Sua conta não possui uma associação ativa com a organização EcoCiente-Instituto-J-F."
      );
    }

    const session = signUserSession(user);
    const login = encodeURIComponent(user.login);

    return res.redirect(302, `${frontendUrl}/#session=${encodeURIComponent(session)}&login=${login}`);
  } catch (error) {
    console.error(error);
    return redirectError(
      res,
      frontendUrl,
      "Não foi possível validar sua conta na organização. Verifique as permissões do GitHub App."
    );
  }
}
