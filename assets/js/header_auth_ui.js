import { isAuthenticated, getUserFromIdToken, logout } from "./auth_social_cognito.js";

const SESSION_CUSTOMER_ID_KEY = "iabag_customer_id_v1";

function hideLiFromHref(href) {
  document.querySelectorAll(`#userLinks a[href="${href}"]`).forEach((a) => {
    const li = a.closest("li");
    if (li) li.style.display = "none";
  });
}

function showLiFromHref(href) {
  document.querySelectorAll(`#userLinks a[href="${href}"]`).forEach((a) => {
    const li = a.closest("li");
    if (li) li.style.display = "";
  });
}

export function updateHeaderAuthUI() {
  const welcomeBox = document.getElementById("auth-welcome");
  const welcomeName = document.getElementById("auth-welcome-name");
  const logoutItem = document.getElementById("nav-logout-item");
  const logoutLink = document.getElementById("nav-logout-link");

  // header pas présent sur toutes pages ? => on sort sans erreur
  if (!welcomeBox || !welcomeName) return;

  // bind logout (une seule fois)
  if (logoutLink && !logoutLink.dataset.bound) {
    logoutLink.dataset.bound = "1";
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  if (!isAuthenticated()) {
    // pas connecté
    welcomeBox.classList.add("d-none");
    welcomeName.textContent = "";
    sessionStorage.removeItem(SESSION_CUSTOMER_ID_KEY);

    // afficher Connexion/S'inscrire
    showLiFromHref("login.html");
    showLiFromHref("register.html");

    // cacher Déconnexion
    if (logoutItem) logoutItem.style.display = "none";
    return;
  }

  // connecté
  const user = getUserFromIdToken();
  const givenName = user?.given_name || "";

  if (givenName) {
    welcomeName.textContent = givenName;
    welcomeBox.classList.remove("d-none");
  } else {
    // tu as demandé given_name uniquement => si absent, on masque "Bienvenue"
    welcomeName.textContent = "";
    welcomeBox.classList.add("d-none");
  }

  // masquer Connexion/S'inscrire
  hideLiFromHref("login.html");
  hideLiFromHref("register.html");

  // afficher Déconnexion
  if (logoutItem) logoutItem.style.display = "";

  // stocker l'identifiant utilisateur pour lier les commandes
  if (user?.sub) sessionStorage.setItem(SESSION_CUSTOMER_ID_KEY, String(user.sub));
}

// init
document.addEventListener("DOMContentLoaded", updateHeaderAuthUI);
window.addEventListener("auth:changed", updateHeaderAuthUI);