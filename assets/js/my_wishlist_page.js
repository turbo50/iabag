/**
 * Page "Mes favoris" (wishlist) — logique front
 *
 * Dépendances:
 *  - ./config.js (export const CONFIG)
 *  - ./auth_storage_keys.js (export const AUTH_STORAGE_KEYS)
 *  - ./auth_social_cognito.js (export { isAuthenticated, getIdToken, setNextUrl? })
 *
 * Attendu côté HTML:
 *  - <tbody id="wishlist-tbody"></tbody>
 *  - <div id="wishlist-loading" class="d-none"></div>
 *  - <div id="wishlist-empty" class="d-none"></div>
 */

import { CONFIG } from "./config.js";
import { AUTH_STORAGE_KEYS } from "./auth_storage_keys.js";
import { isAuthenticated, getIdToken, setNextUrl } from "./auth_social_cognito.js";

const API_BASE_URL = CONFIG?.API_BASE_URL;

const $ = (sel) => document.querySelector(sel);

function show(el, on) {
  if (!el) return;
  el.classList.toggle("d-none", !on);
}

function ensureConfigured() {
  if (!API_BASE_URL) {
    throw new Error("CONFIG.API_BASE_URL est vide (assets/js/config.js).");
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Comme les autres pages protégées (orders.html):
 * Authorization: Bearer <id_token>
 */
function getAuthHeaderValue() {
  if (!isAuthenticated?.()) {
    try {
      // Si setNextUrl existe, on l'utilise; sinon fallback sur la clé "next"
      if (typeof setNextUrl === "function") setNextUrl(window.location.pathname);
      else localStorage.setItem(AUTH_STORAGE_KEYS.next, window.location.pathname);
    } catch {}
    return null;
  }

  const jwt = getIdToken?.();
  if (!jwt) return null;
  return jwt.startsWith("Bearer ") ? jwt : `Bearer ${jwt}`;
}

async function apiFetch(path, opts = {}) {
  ensureConfigured();

  const auth = getAuthHeaderValue();
  if (!auth) {
    throw new Error("Non authentifié : jeton manquant. Veuillez vous connecter pour consulter vos favoris.");
  }

  const url = API_BASE_URL.replace(/\/$/, "") + path;

  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
      ...(opts.headers || {}),
    },
  });

  const text = await res.text().catch(() => "");
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `Erreur HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

/**
 * NOTE:
 * Le backend renvoie des items "table" (ex: { code_client, code_produit, created_at? })
 * => Image / Prix / Stock restent en placeholders "—" tant que tu ne fais pas d'hydratation produit.
 */
function renderRows(items) {
  const tbody = $("#wishlist-tbody");
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = "";
    return;
  }

  tbody.innerHTML = items
    .map((it) => {
      const codeProduit = it?.code_produit ?? it?.code ?? "";
      const safeCode = escapeHtml(String(codeProduit));
      const productUrl = `product-detail.html?code=${encodeURIComponent(codeProduit)}`;

      return `
        <tr data-code="${safeCode}">
          <td class="product-remove text-center">
            <a href="#" class="js-wishlist-remove" data-code="${safeCode}" data-bs-toggle="tooltip" data-bs-placement="top" title="Supprimer">
              <i class="icon icon an an-times-l"></i>
            </a>
          </td>

          <td class="product-thumbnail text-center">
            <a href="${productUrl}">
              <img src="assets/images/products/100x120.jpg" width="100" alt="" title="">
            </a>
          </td>

          <td class="product-name">
            <h6 class="mb-0">
              <a href="${productUrl}">${safeCode}</a>
            </h6>
            ${it?.created_at ? `<div class="small text-muted mt-1">${escapeHtml(it.created_at)}</div>` : ``}
          </td>

          <td class="product-price text-center">
            <span class="amount fw-500">—</span>
          </td>

          <td class="stock text-center">
            <span class="text-in-stock">—</span>
          </td>

          <td class="product-subtotal text-center">
            <a href="cart-style1.html" class="btn btn-small rounded-1 text-nowrap">
              Ajouter au panier
            </a>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadFavorites() {
  const loadingEl = $("#wishlist-loading");
  const emptyEl = $("#wishlist-empty");
  const tbody = $("#wishlist-tbody");

  show(loadingEl, true);
  show(emptyEl, false);

  try {
    if (tbody) tbody.innerHTML = "";

    const data = await apiFetch("/clients/me/wishlist", { method: "GET" });
    const items = data?.items || [];

    if (!items.length) {
      renderRows([]);
      show(emptyEl, true);
      return;
    }

    renderRows(items);
    wireRemoveHandlers();
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4 text-danger">
            ${escapeHtml(err?.message || "Une erreur est survenue lors du chargement de vos favoris.")}
          </td>
        </tr>
      `;
    }
  } finally {
    show(loadingEl, false);
  }
}

async function removeItem(codeProduit) {
  await apiFetch(`/clients/me/wishlist/${encodeURIComponent(codeProduit)}`, { method: "DELETE" });
}

function wireRemoveHandlers() {
  document.querySelectorAll(".js-wishlist-remove").forEach((a) => {
    a.addEventListener("click", async (e) => {
      e.preventDefault();

      const code = e.currentTarget.getAttribute("data-code");
      if (!code) return;

      e.currentTarget.classList.add("disabled");
      try {
        await removeItem(code);

        const tr = document.querySelector(`tr[data-code="${CSS.escape(code)}"]`);
        if (tr) tr.remove();

        const tbody = $("#wishlist-tbody");
        const emptyEl = $("#wishlist-empty");
        const stillHasRows = tbody && tbody.querySelectorAll("tr").length > 0;
        show(emptyEl, !stillHasRows);
      } catch (err) {
        alert(err?.message || "Une erreur est survenue lors de la suppression de ce favori.");
        e.currentTarget.classList.remove("disabled");
      }
    });
  });
}

/**
 * Entrée de page
 */
export function initMyWishlistPage() {
  loadFavorites();
}

// Auto init (simple)
initMyWishlistPage();