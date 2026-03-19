import { CONFIG } from "./config.js";
import { AUTH_STORAGE_KEYS } from "./auth_storage_keys.js";
import { isAuthenticated, getIdToken, setNextUrl } from "./auth_social_cognito.js";

const API_BASE_URL = CONFIG?.API_BASE_URL;

function ensureConfigured() {
  if (!API_BASE_URL) throw new Error("CONFIG.API_BASE_URL est vide (assets/js/config.js).");
}

function getAuthHeaderValueOrNull() {
  if (!isAuthenticated?.()) return null;
  const jwt = getIdToken?.();
  if (!jwt) return null;
  return jwt.startsWith("Bearer ") ? jwt : `Bearer ${jwt}`;
}

async function apiFetch(path, opts = {}) {
  ensureConfigured();

  const auth = getAuthHeaderValueOrNull();
  if (!auth) {
    // mémorise la page de retour + redirige login (comme les autres pages)
    try {
      if (typeof setNextUrl === "function") setNextUrl(window.location.pathname);
      else localStorage.setItem(AUTH_STORAGE_KEYS.next, window.location.pathname);
    } catch {}
    const err = new Error("NOT_AUTHENTICATED");
    err.code = "NOT_AUTHENTICATED";
    throw err;
  }

  const url = API_BASE_URL.replace(/\/$/, "") + path;

  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      Authorization: auth,
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text().catch(() => "");
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || text || `Erreur HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function findCodeProduitFromClickTarget(target) {
  // priorité: data-code sur le bouton coeur (recommandé)
  const fromBtn = target?.closest?.("[data-code]")?.dataset?.code;
  if (fromBtn) return fromBtn;

  // fallback: si la card a data-code (souvent ajouté par buildProductHTML)
  const card = target?.closest?.("[data-code]");
  if (card?.dataset?.code) return card.dataset.code;

  // fallback: bouton quickview data-product-id (déjà utilisé ailleurs)
  const qv = target?.closest?.(".item, .grid-products .item")?.querySelector?.("[data-product-id]");
  const fromQv = qv?.getAttribute?.("data-product-id");
  if (fromQv) return fromQv;

  return null;
}

function setHeartUiActive(el, active) {
  // adapte au thème: on joue sur classe + icône si possible
  el.classList.toggle("is-active", !!active);
  const icon = el.querySelector?.("i");
  if (icon) {
    // si ton thème a an-heart-l (outline) / an-heart (plein), on swap
    if (active) {
      icon.classList.remove("an-heart-l");
      icon.classList.add("an-heart");
    } else {
      icon.classList.remove("an-heart");
      icon.classList.add("an-heart-l");
    }
  }
}

async function addToWishlist(codeProduit) {
  await apiFetch("/clients/me/wishlist", {
    method: "POST",
    body: { code_produit: String(codeProduit) },
  });
}

async function removeFromWishlist(codeProduit) {
  await apiFetch(`/clients/me/wishlist/${encodeURIComponent(String(codeProduit))}`, {
    method: "DELETE",
  });
}

/**
 * Event delegation: marche même si la grille est générée dynamiquement.
 *
 * Il faut que le coeur ait une classe hook:
 * - `.js-wishlist-toggle`
 * et idéalement `data-code="P123"`.
 */
export function initWishlistToggle() {
  document.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.(".js-wishlist-toggle");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

    const codeProduit = btn.dataset.code || findCodeProduitFromClickTarget(btn);
    if (!codeProduit) {
      console.warn("wishlist toggle: code_produit introuvable");
      return;
    }

    // toggle optimiste
    const wasActive = btn.classList.contains("is-active");
    setHeartUiActive(btn, !wasActive);
    btn.classList.add("disabled");

    try {
      if (!wasActive) await addToWishlist(codeProduit);
      else await removeFromWishlist(codeProduit);
    } catch (err) {
      // rollback UI
      setHeartUiActive(btn, wasActive);

      if (err?.code === "NOT_AUTHENTICATED") {
        // redirige vers login
        window.location.href = "login.html";
        return;
      }
      alert(err?.message || "Erreur wishlist.");
    } finally {
      btn.classList.remove("disabled");
    }
  });
}

// auto-init
initWishlistToggle();