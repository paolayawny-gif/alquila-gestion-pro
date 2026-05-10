import { getAuth } from "firebase/auth";

/**
 * Wrapper de fetch que adjunta el ID token de Firebase del usuario logueado.
 * Usar en lugar de `fetch()` para llamar a endpoints `/api/*` protegidos.
 */
export async function authedFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No hay usuario autenticado para esta operación");
  }
  const idToken = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${idToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, { ...init, headers });
}
