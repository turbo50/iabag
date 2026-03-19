import { CONFIG } from "./config.js";
import { AUTH_STORAGE_KEYS } from "./auth_storage_keys.js";
import { isAuthenticated, getIdToken, setNextUrl } from "./auth_social_cognito.js";

import { addItem } from "./cart_service.js"; // <-- met à jour automatiquement le minicart via cart_ui.js (cart:changed)

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

function joinUrl(base, path) {
  return `${String(base).replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`;
}

function getAuthHeaderValue() {
  if (!isAuthenticated?.()) {
    try {
      if (typeof setNextUrl === "function") setNextUrl(window.location.pathname);
      else localStorage.setItem(AUTH_STORAGE_KEYS.next, window.location.pathname);
    } catch {}
    return null;
  }

  const jwt = getIdToken?.();
  if (!jwt) return null;
  return jwt.startsWith("Bearer ") ? jwt : `Bearer ${jwt}`;
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
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

async function apiFetchProtected(path, { method = "GET", body } = {}) {
  ensureConfigured();

  const auth = getAuthHeaderValue();
  if (!auth) {
    throw new Error("Non authentifié : jeton manquant. Veuillez vous connecter pour consulter vos favoris.");
  }

  const url = joinUrl(API_BASE_URL, path);
  return await fetchJson(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      Authorization: auth,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function apiFetchPublic(path, { method = "GET", body } = {}) {
  ensureConfigured();
  const url = joinUrl(API_BASE_URL, path);
  return await fetchJson(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Hydrate via endpoint batch.
 * Contrat supposé (à ajuster si ton Lambda renvoie autre chose):
 * POST /products/batch  body: { codes: ["P001","P002"] }
 * réponse: { items: [ { code_produit, nom_produit, prix_actuel, image_produit, stock?, ... } ] }
 */
async function fetchProductsBatch(codes) {
  const unique = [...new Set((codes || []).filter(Boolean).map(String))];
  if (!unique.length) return [];

  const data = await apiFetchPublic("/products/batch", {
    method: "POST",
    body: { codes: unique },
  });

  // tolérant
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.products)) return data.products;
  return [];
}

function buildProductMap(products) {
  const map = new Map();
  (products || []).forEach((p) => {
    const code = p?.code_produit ?? p?.code ?? p?.id;
    if (code) map.set(String(code), p);
  });
  return map;
}

function formatMoneyEUR(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat(CONFIG.LOCALE || "fr-FR", {
    style: "currency",
    currency: CONFIG.CURRENCY || "EUR",
  }).format(Number(value));
}

function openMiniCartDrawer() {
  const drawerEl = document.getElementById("minicart-drawer");
  if (!drawerEl) return;

  // Bootstrap 5 modal
  if (window.bootstrap?.Modal) {
    try {
      window.bootstrap.Modal.getOrCreateInstance(drawerEl).show();
    } catch {
      // ignore
    }
  }
}

function renderRows(wishlistItems, productMap) {
  const tbody = $("#wishlist-tbody");
  if (!tbody) return;

  if (!wishlistItems.length) {
    tbody.innerHTML = "";
    return;
  }

  tbody.innerHTML = wishlistItems
    .map((it) => {
      const codeProduit = it?.code_produit ?? it?.code ?? "";
      const codeStr = String(codeProduit);
      const p = productMap.get(codeStr);

      const name = p?.nom_produit || codeStr;
      const img = p?.image_produit || "assets/images/products/100x120.jpg";
      const price = p?.prix_actuel ?? p?.prix ?? null;

      // stock: adapte selon ton modèle (ex: p.stock, p.quantite_stock, p.en_stock...)
      const stockVal = p?.stock ?? p?.quantite_stock ?? p?.en_stock;
      const stockLabel =
        stockVal == null
          ? "—"
          : Number(stockVal) > 0
            ? "En stock"
            : "Rupture";

      const productUrl = `product-detail.html?code=${encodeURIComponent(codeStr)}`;

      return `
        <tr data-code="${escapeHtml(codeStr)}">
          <td class="product-remove text-center">
            <a href="#" class="js-wishlist-remove" data-code="${escapeHtml(codeStr)}" data-bs-toggle="tooltip" data-bs-placement="top" title="Supprimer">
              <i class="icon icon an an-times-l"></i>
            </a>
          </td>

          <td class="product-thumbnail text-center">
            <a href="${productUrl}">
              <img src="${escapeHtml(img)}" width="100" alt="${escapeHtml(name)}" title="${escapeHtml(name)}">
            </a>
          </td>

          <td class="product-name">
            <h6 class="mb-0">
              <a href="${productUrl}">${escapeHtml(name)}</a>
            </h6>
            <div class="small text-muted mt-1">${escapeHtml(codeStr)}</div>
            ${it?.created_at ? `<div class="small text-muted">${escapeHtml(it.created_at)}</div>` : ``}
          </td>

          <td class="product-price text-center">
            <span class="amount fw-500">${escapeHtml(formatMoneyEUR(price))}</span>
          </td>

          <td class="stock-status text-center">
            <span class="${stockLabel === "En stock" ? "text-in-stock" : "text-out-stock"}">${escapeHtml(stockLabel)}</span>
          </td>

          <td class="product-subtotal text-center">
            <button
              type="button"
              class="btn btn-small rounded-1 text-nowrap js-add-to-minicart"
              data-code="${escapeHtml(codeStr)}"
            >
              Ajouter au panier
            </button>
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

    const data = await apiFetchProtected("/clients/me/wishlist", { method: "GET" });
    const items = Array.isArray(data?.items) ? data.items : [];

    if (!items.length) {
      renderRows([], new Map());
      show(emptyEl, true);
      return;
    }

    // hydrate produits
    const codes = items.map((x) => x?.code_produit).filter(Boolean);
    const products = await fetchProductsBatch(codes);
    const map = buildProductMap(products);

    renderRows(items, map);

    wireRemoveHandlers();
    wireAddToMiniCartHandlers(map);
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
  await apiFetchProtected(`/clients/me/wishlist/${encodeURIComponent(codeProduit)}`, { method: "DELETE" });
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

function wireAddToMiniCartHandlers(productMap) {
  document.querySelectorAll(".js-add-to-minicart").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const code = e.currentTarget.getAttribute("data-code");
      if (!code) return;

      const p = productMap.get(String(code)) || {};
      const title = p.nom_produit || String(code);
      const price = Number(p.prix_actuel ?? p.prix ?? 0) || 0;
      const image = p.image_produit || "";
      const url = `product-detail.html?code=${encodeURIComponent(String(code))}`;

      // ✅ Ajoute dans le panier localStorage + déclenche cart:changed => minicart se met à jour tout seul
      addItem({
        id: String(code),      // IMPORTANT: code_produit
        title,
        price,
        qty: 1,
        image,
        url,
        variant: "",           // si tu as des variantes plus tard
      });

      // ✅ Ouvre le drawer au lieu d'aller sur une page cart
      openMiniCartDrawer();
    });
  });
}

// Entrée page
export function initMyWishlistPage() {
  loadFavorites();
}

// Auto-init
document.addEventListener("DOMContentLoaded", initMyWishlistPage);