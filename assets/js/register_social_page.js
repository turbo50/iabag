import { renderSocialButtons } from "./social_buttons.js";
import { AUTH_STORAGE_KEYS as K } from "./auth_storage_keys.js";

function setMessage(msg, isError = false) {
  const el = document.getElementById("auth-msg");
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = isError ? "#b00020" : "";
}

function prepareRegisterFlow() {
  const pseudoInput = document.getElementById("reg-pseudo");
  const pseudo = pseudoInput?.value?.trim() || "";

  if (!pseudo) {
    setMessage("Veuillez fournir un pseudo.", true);
    if (pseudoInput) pseudoInput.focus();
    return false;
  }

  localStorage.setItem(K.registerFlow, "1");
  localStorage.setItem(K.registerPseudo, pseudo);
  return true;
}

document.addEventListener("DOMContentLoaded", () => {
  renderSocialButtons("#social-auth-buttons", {
    nextUrl: "index.html",
    beforeStart: () => prepareRegisterFlow(),
  });
});