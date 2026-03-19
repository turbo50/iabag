import { isAuthenticated, getUserFromIdToken, logoutAll } from "./auth_social_cognito.js";

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

  // ✅ AJOUT: item "Mes commandes"
  const ordersItem = document.getElementById("nav-orders-item");
  // ✅ AJOUT: item "Mes favoris"
  const wishListItem = document.getElementById("nav-wishlist-item");
  

  // header pas présent sur toutes pages ? => on sort sans erreur
  if (!welcomeBox || !welcomeName) return;

  // ✅ sécurité: caché par défaut à chaque update (évite tout flash)
  welcomeBox.style.display = "none";
  welcomeBox.classList.add("d-none"); // garde bootstrap si dispo
  welcomeName.textContent = "";

  // ✅ AJOUT: cacher "Mes commandes" par défaut (évite flash)
  if (ordersItem) ordersItem.style.display = "none";
  // ✅ AJOUT: cacher "Mes favoris" par défaut (évite flash)
  if (wishListItem) wishListItem.style.display = "none";

  // bind logout (une seule fois)
  if (logoutLink && !logoutLink.dataset.bound) {
    logoutLink.dataset.bound = "1";
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
       // ✅ purge immédiate (ne dépend pas de isAuthenticated() ni d'événements)
      sessionStorage.removeItem(SESSION_CUSTOMER_ID_KEY);
      localStorage.removeItem("iabag_cart_v1"); // optionnel: vider le panier
      logoutAll();
    });
  }

  if (!isAuthenticated()) {
    // pas connecté
    sessionStorage.removeItem(SESSION_CUSTOMER_ID_KEY);

    // afficher Connexion/S'inscrire
    showLiFromHref("login.html");
    showLiFromHref("register.html");

    // cacher Déconnexion
    if (logoutItem) logoutItem.style.display = "none";

    // ✅ AJOUT: cacher Mes commandes
    if (ordersItem) ordersItem.style.display = "none";
    // ✅ AJOUT: cacher Mes favoris
    if (wishListItem) wishListItem.style.display = "none";

    return;
  }

  // connecté
  const user = getUserFromIdToken();
  const email = user?.email || "";

  // Afficher uniquement si email est présent
  if (email) {
    welcomeName.textContent = `Bonjour ${email} !`;
    welcomeBox.classList.remove("d-none");
    welcomeBox.style.display = ""; // ou "flex"
  } else {
    // email absent => on garde caché
    welcomeBox.style.display = "none";
    welcomeBox.classList.add("d-none");
    welcomeName.textContent = "";
  }

  // masquer Connexion/S'inscrire
  hideLiFromHref("login.html");
  hideLiFromHref("register.html");

  // afficher Déconnexion
  if (logoutItem) logoutItem.style.display = "";

  // ✅ AJOUT: afficher Mes commandes
  if (ordersItem) ordersItem.style.display = "";
  if (wishListItem) wishListItem.style.display = "";

  // stocker l'identifiant utilisateur pour lier les commandes
  if (user?.sub) sessionStorage.setItem(SESSION_CUSTOMER_ID_KEY, String(user.sub));
}

document.addEventListener("DOMContentLoaded", updateHeaderAuthUI);
window.addEventListener("auth:changed", updateHeaderAuthUI);
window.dispatchEvent(new Event("auth:changed"));
