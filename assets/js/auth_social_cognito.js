/**
 * Social login via Amazon Cognito Hosted UI (Authorization Code + PKCE).
 *
 * Usage (example):
 *   import { startSocialLogin } from "./auth_social_cognito.js";
 *   document.querySelector("#btn-google").addEventListener("click", () => startSocialLogin("google"));
 *
 * Requires:
 *  - assets/js/cognito_oauth_config.js exporting COGNITO_OAUTH
 *  - assets/js/auth_storage_keys.js exporting AUTH_STORAGE_KEYS (optional but recommended)
 */

import { COGNITO_OAUTH } from "./cognito_oauth_config.js";
import { AUTH_STORAGE_KEYS as K } from "./auth_storage_keys.js";

function base64UrlEncode(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  const base64 = btoa(str);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(length = 64) {
  // PKCE verifier can be 43-128 chars; using URL-safe charset
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += charset[b % charset.length];
  return out;
}

async function sha256(input) {
  const enc = new TextEncoder();
  return crypto.subtle.digest("SHA-256", enc.encode(input));
}

async function pkceChallengeFromVerifier(verifier) {
  const digest = await sha256(verifier);
  return base64UrlEncode(digest);
}

function assertConfig() {
  if (!COGNITO_OAUTH?.domain) throw new Error("COGNITO_OAUTH.domain manquant");
  if (!COGNITO_OAUTH?.clientId) throw new Error("COGNITO_OAUTH.clientId manquant");
  if (!COGNITO_OAUTH?.redirectUri) throw new Error("COGNITO_OAUTH.redirectUri manquant");
  if (!Array.isArray(COGNITO_OAUTH?.scopes) || COGNITO_OAUTH.scopes.length === 0) {
    throw new Error("COGNITO_OAUTH.scopes manquant");
  }
  if (!COGNITO_OAUTH?.providers) throw new Error("COGNITO_OAUTH.providers manquant");
}

function normalizeDomain(domain) {
  return domain.replace(/\/$/, "");
}

/**
 * Start social login with a provider key defined in COGNITO_OAUTH.providers.
 * Example providerKey: "google"
 */
export async function startSocialLogin(providerKey) {
  assertConfig();

  const p = COGNITO_OAUTH.providers?.[providerKey];
  if (!p || !p.cognitoName) throw new Error(`Provider inconnu: ${providerKey}`);

  const provider = p.cognitoName;

  // PKCE
  const verifier = randomString(64);
  const challenge = await pkceChallengeFromVerifier(verifier);

  // CSRF protection
  const state = randomString(32);

  // Persist for callback page
  localStorage.setItem(K.pkceVerifier, verifier);
  localStorage.setItem(K.oauthState, state);

  // Optional: remember where to go after login
  // localStorage.setItem(K.next, window.location.pathname);

  const u = new URL(`${normalizeDomain(COGNITO_OAUTH.domain)}/oauth2/authorize`);
  u.searchParams.set("client_id", COGNITO_OAUTH.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", COGNITO_OAUTH.redirectUri);
  u.searchParams.set("scope", COGNITO_OAUTH.scopes.join(" "));
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("code_challenge", challenge);

  // Force the IdP (e.g., Google)
  u.searchParams.set("identity_provider", provider);
  u.searchParams.set("prompt", "login");
  
  window.location.assign(u.toString());
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

function getTokens() {
  const raw = localStorage.getItem(K.tokens);
  return raw ? safeJsonParse(raw) : null;
}

/**
 * ✅ AJOUT: récupérer le token brut pour appeler l'API
 */
export function getIdToken() {
  const t = getTokens();
  return t?.id_token || "";
}

/**
 * ✅ AJOUT: utile si ton API Gateway authorizer attend access_token au lieu de id_token
 */
export function getAccessToken() {
  const t = getTokens();
  return t?.access_token || "";
}

/**
 * ✅ AJOUT: mémorise où revenir après login (utilisé par auth_callback_page.js)
 */
export function setNextUrl(nextUrl) {
  if (!nextUrl) return;
  localStorage.setItem(K.next, String(nextUrl));
}

export function getUserFromIdToken() {
  const t = getTokens();
  return decodeJwtPayload(t?.id_token);
}

export function isAuthenticated() {
  const payload = getUserFromIdToken();
  if (!payload) return false;

  // exp est en secondes (JWT), Date.now() en ms
  const expMs = Number(payload.exp || 0) * 1000;
  if (!expMs) return true; // si pas d'exp, on considère connecté (rare)
  return Date.now() < expMs;
}

export function logout() {
  // purge local state
  localStorage.removeItem(K.tokens);
  localStorage.removeItem(K.next);
  localStorage.removeItem(K.pkceVerifier);
  localStorage.removeItem(K.oauthState);

  // notifie l'UI (login_social_page écoute auth:changed)
  window.dispatchEvent(new Event("auth:changed"));

  // logout Cognito Hosted UI (important pour nettoyer la session Cognito)
  try {
    const domain = COGNITO_OAUTH.domain.replace(/\/$/, "");
    const u = new URL(`${domain}/logout`);
    u.searchParams.set("client_id", COGNITO_OAUTH.clientId);
    u.searchParams.set("logout_uri", COGNITO_OAUTH.logoutUri);
    window.location.assign(u.toString());
  } catch {
    // fallback
    window.location.assign(COGNITO_OAUTH.logoutUri);
  }
}

export function logoutAll() {
  // Purge tout le localStorage (optionnel, mais safe)
  try {
    localStorage.clear(); // attention aux autres applis sur le domaine, sinon...
  } catch {}

  // Option : purger uniquement les clés connues
  [
    K.tokens,
    K.next,
    K.pkceVerifier,
    K.oauthState,
    "iabag_cart_v1",
    "iabag_customer_id_v1",
    // Ajoute d'autres clés si tu utilises d'autres storage (ex: wishlist, etc.)
  ].forEach(key => {
    try { localStorage.removeItem(key); } catch {}
    try { sessionStorage.removeItem(key); } catch {}
  });

  // Purge sessionStorage entier
  try { sessionStorage.clear(); } catch {}

  // Purge cookies (si tu en as utilisés, ex: "CognitoIdentityServiceProvider...")
  document.cookie.split(";").forEach((c) => {
    const [name] = c.split("=");
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/';
  });

  // Notifie l’UI
  window.dispatchEvent(new Event("auth:changed"));

  // Redirection Hosted UI logout Cognito (nettoie tous les tokens Cognito côté serveur)
  try {
    const domain = COGNITO_OAUTH.domain.replace(/\/$/, "");
    const u = new URL(`${domain}/logout`);
    u.searchParams.set("client_id", COGNITO_OAUTH.clientId);
    u.searchParams.set("logout_uri", COGNITO_OAUTH.logoutUri);
    window.location.assign(u.toString());
  } catch {
    window.location.assign(COGNITO_OAUTH.logoutUri);
  }
}