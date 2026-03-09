import { COGNITO_OAUTH } from "./cognito_oauth_config.js";
import { AUTH_STORAGE_KEYS as K } from "./auth_storage_keys.js";

function setStatus(msg) {
  const el = document.getElementById("auth-status");
  if (el) el.textContent = msg;
}

function toFormUrlEncoded(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function exchangeCodeForTokens({ code, codeVerifier }) {
  const body = toFormUrlEncoded({
    grant_type: "authorization_code",
    client_id: COGNITO_OAUTH.clientId,
    code,
    redirect_uri: COGNITO_OAUTH.redirectUri,
    code_verifier: codeVerifier,
  });

  const res = await fetch(`${COGNITO_OAUTH.domain.replace(/\/$/, "")}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  return res.json();
}

function getNextUrl() {
  return localStorage.getItem(K.next) || "/index.html";
}

async function main() {
  try {
    setStatus("Connexion en cours…");

    const url = new URL(window.location.href);
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");
    if (error) throw new Error(`${error}${errorDescription ? `: ${errorDescription}` : ""}`);

    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    if (!code) throw new Error("Paramètre 'code' manquant dans l’URL de callback.");

    const expectedState = localStorage.getItem(K.oauthState);
    if (expectedState && returnedState && expectedState !== returnedState) {
      throw new Error("State OAuth invalide (CSRF). Relance la connexion.");
    }

    const codeVerifier = localStorage.getItem(K.pkceVerifier);
    if (!codeVerifier) {
      throw new Error("PKCE code_verifier introuvable. Relance la connexion depuis login/register.");
    }

    setStatus("Récupération des tokens…");
    const tokens = await exchangeCodeForTokens({ code, codeVerifier });

    // nettoyage
    localStorage.removeItem(K.pkceVerifier);
    localStorage.removeItem(K.oauthState);

    localStorage.setItem(
      K.tokens,
      JSON.stringify({
        ...tokens,
        obtained_at: Date.now(),
      })
    );

    setStatus("Connecté. Redirection…");
    window.location.replace(getNextUrl());
  } catch (e) {
    console.error(e);
    setStatus(`Erreur: ${e?.message || e}`);
  }
}

main();