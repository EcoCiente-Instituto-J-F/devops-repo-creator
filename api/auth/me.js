import { applyCors, handleOptions } from "../../lib/cors.js";
import { getSessionFromRequest } from "../../lib/session.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Método não permitido." });
  }

  try {
    const session = getSessionFromRequest(req);
    return res.status(200).json({
      login: session.login,
      organization: session.org
    });
  } catch {
    return res.status(401).json({ message: "Sessão inválida ou expirada." });
  }
}
