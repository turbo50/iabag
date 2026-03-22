import { renderSocialButtons } from "./social_buttons.js";
import { CONFIG } from "./config.js";
import {
  getIdToken,
  isAuthenticated,
} from "./auth_social_cognito.js";
import { AUTH_STORAGE_KEYS as K } from "./auth_storage_keys.js";

function byId(id) {
  return document.getElementById(id);
}

function setMessage(msg, isError = false) {
  const el = byId("auth-msg");
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = isError ? "#b00020" : "";
}

function getStoredNextUrl() {
  return localStorage.getItem(K.next) || "index.html";
}

async function readJsonResponse(res) {
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

async function authFetch(path, { method = "GET", body } = {}) {
  const token = getIdToken();
  if (!token) throw new Error("Token d'authentification introuvable.");

  const res = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  return readJsonResponse(res);
}

async function loadProfile() {
  try {
    return await authFetch("/clients/me/profile");
  } catch {
    return null;
  }
}

function getPseudoInput() {
  return byId("reg-pseudo");
}

function getPseudoValue() {
  return getPseudoInput()?.value?.trim() || "";
}

function prepareRegisterFlow() {
  const pseudoInput = getPseudoInput();
  const pseudo = getPseudoValue();

  if (!pseudo) {
    setMessage("Veuillez fournir un pseudo.", true);
    if (pseudoInput) pseudoInput.focus();
    return false;
  }

  localStorage.setItem(K.registerFlow, "1");
  localStorage.setItem(K.registerPseudo, pseudo);
  setMessage("");
  return true;
}

async function finalizeExistingAuthenticatedUser() {
  const pseudoInput = getPseudoInput();
  const pseudo = getPseudoValue();

  if (!pseudo) {
    setMessage("Veuillez fournir un pseudo.", true);
    pseudoInput?.focus();
    return;
  }

  try {
    await authFetch("/clients/me/profile", {
      method: "POST",
      body: { pseudo },
    });

    localStorage.removeItem(K.registerFlow);
    localStorage.removeItem(K.registerPseudo);
    window.location.href = getStoredNextUrl();
  } catch (err) {
    setMessage(`Erreur lors de l'enregistrement du pseudo : ${err.message || "inconnue"}`, true);
  }
}

function ensureCompleteButton() {
  let btn = byId("complete-register-btn");
  if (btn) return btn;

  const host = byId("social-auth-buttons");
  if (!host || !host.parentElement) return null;

  btn = document.createElement("button");
  btn.type = "button";
  btn.id = "complete-register-btn";
  btn.className = "btn rounded mt-3";
  btn.textContent = "Terminer mon inscription";
  btn.style.display = "none";

  host.parentElement.insertBefore(btn, host.nextSibling);
  return btn;
}

async function initAuthenticatedRegisterMode() {
  const profile = await loadProfile();

  if (profile?.pseudo) {
    window.location.href = getStoredNextUrl();
    return;
  }

  setMessage("Finalisez votre inscription en choisissant un pseudo.");
  const socialButtons = byId("social-auth-buttons");
  if (socialButtons) socialButtons.style.display = "none";

  const btn = ensureCompleteButton();
  if (btn) {
    btn.style.display = "";
    btn.addEventListener("click", finalizeExistingAuthenticatedUser);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  ensureCompleteButton();

  if (isAuthenticated()) {
    await initAuthenticatedRegisterMode();
    return;
  }

  renderSocialButtons("#social-auth-buttons", {
    nextUrl: "index.html",
    beforeStart: () => prepareRegisterFlow(),
  });
});