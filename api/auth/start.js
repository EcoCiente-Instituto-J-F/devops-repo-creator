import { getConfig } from "../../lib/config.js";
import { signOAuthState } from "../../lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Método não permitido." });
  }

  try {
    const { githubClientId, backendUrl } = getConfig();
    const state = signOAuthState();

    const params = new URLSearchParams({
      client_id: githubClientId,
      redirect_uri: `${backendUrl}/api/auth/callback`,
      state,
      allow_signup: "false"
    });

    return res.redirect(302, `https://github.com/login/oauth/authorize?${params.toString()}`);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Não foi possível iniciar a autenticação." });
  }
}
