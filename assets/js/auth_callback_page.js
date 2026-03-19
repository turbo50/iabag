import { COGNITO_OAUTH } from "./cognito_oauth_config.js";
import { AUTH_STORAGE_KEYS as K } from "./auth_storage_keys.js";
import { CONFIG } from "./config.js";

function setStatus(msg) {
  const el = document.getElementById("auth-status");
  if (el) el.textContent = msg;
}

function toFormUrlEncoded(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function base64UrlToString(b64url) {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64);
}

function decodeJwtPayload(jwt) {
  if (!jwt || typeof jwt !== "string") return null;
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64UrlToString(parts[1]));
  } catch {
    return null;
  }
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

function getStoredTokens() {
  const raw = localStorage.getItem(K.tokens);
  return raw ? safeJsonParse(raw) : null;
}

function getIdToken() {
  const t = getStoredTokens();
  return t?.id_token || "";
}

function getAccessToken() {
  const t = getStoredTokens();
  return t?.access_token || "";
}

function getUserFromIdToken() {
  return decodeJwtPayload(getIdToken());
}

async function postJson(url, body, token) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text().catch(() => "");
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.error || json?.message || text || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = json || text;
    throw err;
  }

  return json;
}

async function finalizeRegisterIfNeeded() {
  const isRegisterFlow = localStorage.getItem(K.registerFlow) === "1";
  if (!isRegisterFlow) return;

  const pseudo = (localStorage.getItem(K.registerPseudo) || "").trim();
  if (!pseudo) {
    throw new Error("Pseudo introuvable après le retour Cognito.");
  }

  const user = getUserFromIdToken();
  const code_client = user?.sub;
  if (!code_client) {
    throw new Error("sub Cognito introuvable dans l'id_token.");
  }

  // Par défaut on tente id_token, puisque ton front actuel s'appuie dessus.
  // Si ton authorizer attend access_token, remplace idToken par accessToken ci-dessous.
  const idToken = getIdToken();
  if (!idToken) {
    throw new Error("Token d'authentification introuvable.");
  }

  await postJson(
    `${CONFIG.API_BASE_URL}/clients/me/profile`,
    { pseudo, code_client },
    idToken
  );

  localStorage.removeItem(K.registerFlow);
  localStorage.removeItem(K.registerPseudo);
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

    localStorage.removeItem(K.pkceVerifier);
    localStorage.removeItem(K.oauthState);

    localStorage.setItem(
      K.tokens,
      JSON.stringify({
        ...tokens,
        obtained_at: Date.now(),
      })
    );

    setStatus("Finalisation du compte…");
    await finalizeRegisterIfNeeded();

    setStatus("Connecté. Redirection…");
    window.location.replace(getNextUrl());
  } catch (e) {
    console.error(e);
    setStatus(`Erreur: ${e?.message || e}`);
  }
}

main();