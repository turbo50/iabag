import { CONFIG } from "./config.js";
import {
  isAuthenticated,
  getUserFromIdToken,
  getIdToken,
  logoutAll,
} from "./auth_social_cognito.js";

const SESSION_CUSTOMER_ID_KEY = "iabag_customer_id_v1";
const PROFILE_CACHE_KEY = "iabag_profile_cache_v1";

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

function getCachedProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedProfile(profile) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile || {}));
  } catch {
    // ignore
  }
}

function clearCachedProfile() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // ignore
  }
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

async function fetchProfile() {
  const token = getIdToken();
  if (!token) return null;

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/clients/me/profile`, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const profile = await readJsonResponse(res);
    setCachedProfile(profile);
    return profile;
  } catch (err) {
    console.warn("Impossible de charger le profil client pour le header", err);
    return getCachedProfile();
  }
}

function resetWelcomeUI(welcomeBox, welcomeName) {
  welcomeBox.style.display = "none";
  welcomeBox.classList.add("d-none");
  welcomeName.textContent = "";
}

function showWelcome(welcomeBox, welcomeName, label) {
  if (!label) {
    resetWelcomeUI(welcomeBox, welcomeName);
    return;
  }

  welcomeName.textContent = `Bonjour ${label} !`;
  welcomeBox.classList.remove("d-none");
  welcomeBox.style.display = "";
}

export async function updateHeaderAuthUI() {
  const welcomeBox = document.getElementById("auth-welcome");
  const welcomeName = document.getElementById("auth-welcome-name");
  const logoutItem = document.getElementById("nav-logout-item");
  const logoutLink = document.getElementById("nav-logout-link");
  const ordersItem = document.getElementById("nav-orders-item");
  const wishListItem = document.getElementById("nav-wishlist-item");

  if (!welcomeBox || !welcomeName) return;

  resetWelcomeUI(welcomeBox, welcomeName);

  if (ordersItem) ordersItem.style.display = "none";
  if (wishListItem) wishListItem.style.display = "none";

  if (logoutLink && !logoutLink.dataset.bound) {
    logoutLink.dataset.bound = "1";
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();

      sessionStorage.removeItem(SESSION_CUSTOMER_ID_KEY);
      clearCachedProfile();
      localStorage.removeItem("iabag_cart_v1");
      logoutAll();
    });
  }

  if (!isAuthenticated()) {
    sessionStorage.removeItem(SESSION_CUSTOMER_ID_KEY);
    clearCachedProfile();

    showLiFromHref("login.html");
    showLiFromHref("register.html");

    if (logoutItem) logoutItem.style.display = "none";
    if (ordersItem) ordersItem.style.display = "none";
    if (wishListItem) wishListItem.style.display = "none";

    return;
  }

  const user = getUserFromIdToken();
  const fallbackEmail = user?.email || "";

  if (user?.sub) {
    sessionStorage.setItem(SESSION_CUSTOMER_ID_KEY, String(user.sub));
  }

  hideLiFromHref("login.html");
  hideLiFromHref("register.html");

  if (logoutItem) logoutItem.style.display = "";
  if (ordersItem) ordersItem.style.display = "";
  if (wishListItem) wishListItem.style.display = "";

  const profile = await fetchProfile();
  const pseudo = String(profile?.pseudo || "").trim();

  if (pseudo) {
    showWelcome(welcomeBox, welcomeName, pseudo);
  } else if (fallbackEmail) {
    showWelcome(welcomeBox, welcomeName, fallbackEmail);
  } else {
    resetWelcomeUI(welcomeBox, welcomeName);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateHeaderAuthUI().catch((err) => console.error(err));
});

window.addEventListener("auth:changed", () => {
  updateHeaderAuthUI().catch((err) => console.error(err));
});

window.dispatchEvent(new Event("auth:changed"));