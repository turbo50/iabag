import { COGNITO_OAUTH } from "./cognito_oauth_config.js";
import { startSocialLogin, setNextUrl } from "./auth_social_cognito.js";

/**
 * But:
 * - Ne pas dupliquer la logique "où rediriger après login"
 * - Utiliser la clé officielle AUTH_STORAGE_KEYS.next via setNextUrl()
 * - Ne PAS écraser une redirection déjà posée (ex: clic "Commander" minicart)
 */

function providerClass(key) {
  if (key === "google") return "social-btn--google";
  if (key === "facebook") return "social-btn--facebook";
  if (key === "apple") return "social-btn--apple";
  return "";
}

function providerIconSvg(key) {
  // SVGs inline (simples, nets, sans libs externes)
  if (key === "google") {
    // "G" multicolore (simplifié, mais fidèle visuellement)
    return `
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.644 32.657 29.229 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.967 3.033l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"/>
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.967 3.033l5.657-5.657C34.046 6.053 29.268 4 24 4 16.317 4 9.656 8.337 6.306 14.691z"/>
        <path fill="#4CAF50" d="M24 44c5.127 0 9.821-1.97 13.348-5.182l-6.166-5.219C29.112 35.091 26.715 36 24 36c-5.208 0-9.61-3.318-11.285-7.946l-6.517 5.02C9.505 39.556 16.227 44 24 44z"/>
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.801 2.245-2.253 4.145-4.121 5.599l.003-.002 6.166 5.219C36.914 39.205 44 34 44 24c0-1.341-.138-2.651-.389-3.917z"/>
      </svg>
    `;
  }

  if (key === "facebook") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M22 12.07C22 6.507 17.523 2 12 2S2 6.507 2 12.07C2 17.09 5.657 21.23 10.438 22v-7.03H7.898v-2.9h2.54V9.845c0-2.522 1.492-3.915 3.777-3.915 1.094 0 2.238.195 2.238.195v2.475h-1.26c-1.242 0-1.63.776-1.63 1.572v1.89h2.773l-.443 2.9h-2.33V22C18.343 21.23 22 17.09 22 12.07z"/>
      </svg>
    `;
  }

  if (key === "apple") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M16.365 1.43c0 1.14-.416 2.204-1.25 3.187-.99 1.14-2.197 1.8-3.512 1.695-.167-1.096.31-2.227 1.174-3.176.95-1.063 2.29-1.77 3.588-1.706zm3.2 16.91c-.48 1.11-.71 1.6-1.33 2.58-.87 1.37-2.09 3.08-3.6 3.09-1.34.01-1.69-.88-3.5-.87-1.81.01-2.2.88-3.54.86-1.51-.01-2.67-1.56-3.54-2.93C3.6 17.54 2 13.1 3.6 10.3c.78-1.36 2.02-2.16 3.33-2.16 1.29 0 2.1.89 3.49.89 1.35 0 2.17-.89 3.52-.89 1.16 0 2.39.64 3.17 1.74-2.78 1.52-2.33 5.46.46 6.68z"/>
      </svg>
    `;
  }

  // fallback
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>`;
}

function getRedirectFromQuery() {
  // Support optionnel: login.html?redirect=...
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get("redirect");
  } catch {
    return null;
  }
}

export function renderSocialButtons(containerSelector, { nextUrl = "index.html", preserveExistingNext = true } = {}) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  container.innerHTML = "";
  container.classList.add("social-auth-buttons");

  const providers = COGNITO_OAUTH.providers || {};
  const enabledKeys = Object.keys(providers).filter((k) => providers[k]?.enabled);

  if (!enabledKeys.length) {
    container.innerHTML = `<p>Aucun fournisseur social n'est activé.</p>`;
    return;
  }

  enabledKeys.forEach((key) => {
    const p = providers[key];

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn rounded social-btn ${providerClass(key)}`.trim();

    btn.innerHTML = `
      <span class="social-btn__icon" aria-hidden="true">${providerIconSvg(key)}</span>
      <span>${p.label || `Continuer avec ${key}`}</span>
    `;

    btn.addEventListener("click", async () => {
      /**
       * Priorité de redirection:
       * 1) login.html?redirect=... (si tu l’utilises)
       * 2) nextUrl passé en param
       *
       * Et surtout: si preserveExistingNext=true, on n’écrase pas une valeur
       * déjà posée par minicart checkout (setNextUrl(window.location.href)).
       */
      const desiredNext = getRedirectFromQuery() || nextUrl || "index.html";

      if (preserveExistingNext) {
        // setNextUrl() écrase toujours; donc on ne l'appelle que si on n'a pas déjà posé une valeur.
        // Comme on ne veut pas dépendre de la structure interne, on refait une lecture simple :
        // (si tu veux 0 duplication totale, on peut aussi exposer getNextUrl() dans auth_social_cognito.js)
        try {
          const existing = localStorage.getItem("iabag_auth_next_v1");
          if (!existing) setNextUrl(desiredNext);
        } catch {
          setNextUrl(desiredNext);
        }
      } else {
        setNextUrl(desiredNext);
      }

      await startSocialLogin(key);
    });

    container.appendChild(btn);
  });
}