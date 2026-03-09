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

  window.location.assign(u.toString());
}