console.log("✅ load_product_grill.js chargé", { href: location.href });
window.__GRILL_LOADED__ = true;

// Config globale (mock + API Gateway base URL)
import { CONFIG } from "./config.js";

// Auth (pour routes protégées wishlist)
import { AUTH_STORAGE_KEYS } from "./auth_storage_keys.js";
import { isAuthenticated, getIdToken, setNextUrl } from "./auth_social_cognito.js";

function joinUrl(base, path) {
  return `${String(base).replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });

  // Erreurs HTTP (404/500/etc.)
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText} ${body}`);
  }

  return await res.json();
}

async function fetchJsonAuth(url, { method = "GET", body } = {}) {
  const token = getIdToken?.();
  const auth = token ? (token.startsWith("Bearer ") ? token : `Bearer ${token}`) : null;

  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(auth ? { Authorization: auth } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

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

export async function fetchProducts() {
  // 1) Mode mock = lit CONFIG.MOCK_PRODUCTS_URL (ex: data/product.json)
  if (CONFIG?.USE_MOCK) {
    if (!CONFIG?.MOCK_PRODUCTS_URL) {
      throw new Error("CONFIG.MOCK_PRODUCTS_URL est vide (assets/js/config.js).");
    }

    const mockUrl = CONFIG.MOCK_PRODUCTS_URL;
    console.log("➡️ Mock activé : lecture JSON", { url: mockUrl });

    const data = await fetchJson(mockUrl);

    // mock JSON attendu: tableau de produits
    const products = Array.isArray(data) ? data : data?.items ?? [];
    window.PRODUCTS = products;
    return products;
  }

  // 2) Mode API = appelle API Gateway
  if (!CONFIG?.API_BASE_URL || CONFIG.API_BASE_URL.includes("REPLACE_ME")) {
    throw new Error(
      "CONFIG.API_BASE_URL n'est pas configurée (assets/js/config.js). Remplace REPLACE_ME par l'URL de ton API Gateway."
    );
  }

  const url = joinUrl(CONFIG.API_BASE_URL, "/products");
  console.log("➡️ Mock désactivé : appel API Gateway", { url });

  const data = await fetchJson(url);

  // API peut renvoyer [] ou { items: [] }
  const products = Array.isArray(data) ? data : data?.items ?? [];
  window.PRODUCTS = products;
  return products;
}

function applyLabel(card, product) {
  const el = card.querySelector(".product-labels");
  if (!el) return;

  const label = (product.label || "").trim();
  if (!label) {
    el.remove(); // ou el.style.display = "none";
  }
}

function fillTemplate(template, product) {
  return template.replace(/\$[a-zA-Z0-9_]+/g, (match) => {
    const key = match.substring(1); // enlève le $
    return product[key] !== undefined ? product[key] : "";
  });
}

/**
 * =========================
 * ✅ WISHLIST state (préchargement)
 * =========================
 *
 * - On précharge la wishlist de l'utilisateur connecté (si token dispo)
 * - On stocke les code_produit dans un Set
 * - On remplit les coeurs lors du rendu des cartes
 * - On met à jour le Set lors des toggles (POST/DELETE)
 */
let wishlistCodes = new Set(); // codes produits déjà en wishlist
let wishlistLoaded = false;

function getAuthHeaderValueOrNull() {
  const token = getIdToken?.();
  if (!token) return null;
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

async function preloadWishlistCodes() {
  // Ne tente rien si pas connecté (page publique)
  if (!isAuthenticated?.()) {
    wishlistCodes = new Set();
    wishlistLoaded = true;
    return wishlistCodes;
  }

  // Si "auth" OK mais token absent => considère comme non connecté
  const auth = getAuthHeaderValueOrNull();
  if (!auth) {
    wishlistCodes = new Set();
    wishlistLoaded = true;
    return wishlistCodes;
  }

  try {
    const url = joinUrl(CONFIG.API_BASE_URL, "/clients/me/wishlist");
    const data = await fetchJsonAuth(url, { method: "GET" });
    const items = Array.isArray(data?.items) ? data.items : [];
    wishlistCodes = new Set(
      items
        .map((it) => it?.code_produit)
        .filter((x) => typeof x === "string" && x.length > 0)
    );
    wishlistLoaded = true;
    console.log("✅ Wishlist préchargée", { count: wishlistCodes.size });
    return wishlistCodes;
  } catch (err) {
    // Si le token est expiré / 401, on n'empêche pas la page produits d'afficher
    wishlistCodes = new Set();
    wishlistLoaded = true;
    console.warn("⚠️ Impossible de précharger la wishlist (on continue sans état)", err);
    return wishlistCodes;
  }
}

function setHeartUi(btn, active) {
  if (!btn) return;
  btn.classList.toggle("is-active", !!active);

  const icon = btn.querySelector?.("i");
  if (!icon) return;

  // Thème: outline = an-heart-l / plein = an-heart
  if (active) {
    icon.classList.remove("an-heart-l");
    icon.classList.add("an-heart");
  } else {
    icon.classList.remove("an-heart");
    icon.classList.add("an-heart-l");
  }
}

function applyWishlistUiState(card, codeProduit) {
  if (!card || !codeProduit) return;
  const btn = card.querySelector?.(".js-wishlist-toggle");
  if (!btn) return;

  // Si preload pas encore fait, on laisse le coeur en "outline"
  if (!wishlistLoaded) return;

  const active = wishlistCodes.has(String(codeProduit));
  setHeartUi(btn, active);
}

function buildProductHTML(product) {
  const template = document.getElementById("product-template").innerHTML;

  const filled = fillTemplate(template, product);

  const wrapper = document.createElement("div");
  wrapper.innerHTML = filled.trim();

  const card = wrapper.firstElementChild;

  // Ajout pour navigation fiable
  if (card && product?.code_produit) {
    card.dataset.code = product.code_produit;
  }

  // ✅ MODIF WISHLIST:
  // On transforme le lien "wishlist" de la card (template) en bouton qui toggle wishlist,
  // au lieu de naviguer vers my-wishlist.html.
  // Dans ton template, le coeur a: <a class="btn-icon wishlist add-to-wishlist" href="my-wishlist.html">...</a>
  const wishlistBtn = card?.querySelector?.(".add-to-wishlist");
  if (wishlistBtn && product?.code_produit) {
    wishlistBtn.classList.add("js-wishlist-toggle");
    wishlistBtn.setAttribute("href", "#"); // empêche la navigation
    wishlistBtn.dataset.code = product.code_produit;
    wishlistBtn.setAttribute("aria-label", "Ajouter à mes favoris");
  }

  // ✅ applique l'état (coeur plein/outline) si wishlist préchargée
  if (card && product?.code_produit) {
    applyWishlistUiState(card, product.code_produit);
  }

  return card;
}

function fillColorList(container, colors) {
  container.innerHTML = "";

  colors.forEach((color) => {
    const name = typeof color === "string" ? color : color.name;
    const cssClass = typeof color === "string" ? color.toLowerCase() : color.cssClass;

    const li = document.createElement("li");
    li.className = `medium radius ${cssClass}`;
    li.setAttribute("title", name || "");

    li.innerHTML = `
      <span class="swacth-btn" title="${name || ""}"></span>
      <span class="tooltip-label top">${name || ""}</span>
    `;

    container.appendChild(li);
  });
}

function applyDynamicLists(card, product) {
  // Tous les éléments dans le bloc produit ayant l'attribut data-colors
  const colorLists = card.querySelectorAll("[data-colors]");

  colorLists.forEach((list) => {
    const key = list.getAttribute("data-colors");
    const colors = product[key] || [];
    fillColorList(list, colors);
  });
}

function openQuickView(productId) {
  const product = window.PRODUCTS.find((p) => p.code_produit === productId);

  if (!product) {
    console.error("Produit introuvable pour QuickView");
    return;
  }

  fillQuickView(product);

  $.magnificPopup.open({
    items: { src: "#quickView-modal" },
    type: "inline",
  });
}

function fillQuickView(product) {
  // ---------------------------
  // TITRE, SKU, PRIX
  // ---------------------------
  document.getElementById("qv-title").textContent = product.nom_produit;
  document.getElementById("qv-sku").textContent = product.sku;
  document.getElementById("qv-marque").textContent = product.marque_produit;
  document.getElementById("qv-oldprice").textContent = product.ancien_prix + " €";
  document.getElementById("qv-price").textContent = product.prix_actuel + " €";

  // ---------------------------
  // IMAGES DU CAROUSSEL
  // ---------------------------
  const carousel = document.getElementById("qv-carousel");
  const thumbs = document.getElementById("qv-thumbs");

  carousel.innerHTML = "";
  thumbs.innerHTML = "";

  // Image principale
  const allImages = [product.image_produit, ...(product.autres_images || [])];

  allImages.forEach((imgUrl, index) => {
    // Slide principal
    carousel.innerHTML += `
      <div class="carousel-item ${index === 0 ? "active" : ""}">
        <img class="blur-up lazyload" src="${imgUrl}" alt="">
      </div>
    `;

    // Miniature
    thumbs.innerHTML += `
      <div class="list-inline-item ${index === 0 ? "active" : ""}"
           data-bs-slide-to="${index}" data-bs-target="#quickView">
        <img class="blur-up lazyload" src="${imgUrl}" alt="">
      </div>
    `;
  });

  // ---------------------------
  // COULEURS
  // ---------------------------
  const colorBox = document.getElementById("qv-colors");
  colorBox.innerHTML = "";

  (product.liste_couleur || []).forEach((color) => {
    // Si mock/API fournit un objet {name, cssClass}, on supporte aussi
    const name = typeof color === "string" ? color : color.name;
    const cssClass = typeof color === "string" ? color : color.cssClass;

    colorBox.innerHTML += `
      <li class="swatch-element color available">
        <label class="rounded-0 swatchLbl small color ${cssClass}" title="${name}"></label>
        <span class="tooltip-label top">${name}</span>
      </li>
    `;
  });
}

function setupQuickViewButtons() {
  document.querySelectorAll("[data-product-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const productId = btn.getAttribute("data-product-id");
      openQuickView(productId);
    });
  });
}

function renderRatingStars(container, rating) {
  container.innerHTML = ""; // nettoie le contenu

  const fullStars = Math.floor(rating);
  const halfStar = (rating % 1) >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

  // Étoiles pleines
  for (let i = 0; i < fullStars; i++) {
    container.innerHTML += '<i class="an an-star"></i>';
  }

  // Demi-étoile
  if (halfStar) {
    container.innerHTML += '<i class="an an-star-half-o"></i>';
  }

  // Étoiles vides
  for (let i = 0; i < emptyStars; i++) {
    container.innerHTML += '<i class="an an-star-o"></i>';
  }
}

function applyRatingStars(card, product) {
  card.querySelectorAll(".product-review").forEach((el) => {
    const rating = parseFloat(el.getAttribute("data-rating"));
    if (!isNaN(rating)) {
      renderRatingStars(el, rating);
    }
  });
}

async function wishlistAdd(codeProduit) {
  const url = joinUrl(CONFIG.API_BASE_URL, "/clients/me/wishlist");
  await fetchJsonAuth(url, { method: "POST", body: { code_produit: String(codeProduit) } });

  // ✅ update cache
  wishlistCodes.add(String(codeProduit));
}

async function wishlistRemove(codeProduit) {
  const url = joinUrl(CONFIG.API_BASE_URL, `/clients/me/wishlist/${encodeURIComponent(String(codeProduit))}`);
  await fetchJsonAuth(url, { method: "DELETE" });

  // ✅ update cache
  wishlistCodes.delete(String(codeProduit));
}

function redirectToLogin() {
  try {
    if (typeof setNextUrl === "function") setNextUrl(window.location.pathname);
    else localStorage.setItem(AUTH_STORAGE_KEYS.next, window.location.pathname);
  } catch {}
  window.location.href = "login.html";
}

/**
 * Event delegation: marche même si la grille est générée dynamiquement.
 * Toggle:
 * - si pas actif => POST
 * - si actif => DELETE
 */
function wireWishlistToggle() {
  document.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.(".js-wishlist-toggle");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

    // Auth check
    if (!isAuthenticated?.() || !getIdToken?.()) {
      return redirectToLogin();
    }

    const code = btn.dataset.code || btn.closest?.("[data-code]")?.dataset?.code;
    if (!code) {
      console.warn("⚠️ Wishlist click mais code_produit introuvable", { btn });
      return;
    }

    const codeStr = String(code);

    // état depuis notre cache (plus fiable que lire la classe)
    const wasActive = wishlistLoaded ? wishlistCodes.has(codeStr) : btn.classList.contains("is-active");

    // UI optimiste
    setHeartUi(btn, !wasActive);
    btn.classList.add("disabled");

    try {
      if (!wasActive) await wishlistAdd(codeStr);
      else await wishlistRemove(codeStr);
    } catch (err) {
      // rollback UI + cache (cache déjà modifié dans add/remove uniquement en cas de succès)
      setHeartUi(btn, wasActive);

      // si 401 => login
      if (err?.status === 401 || /unauthorized/i.test(String(err?.message || ""))) {
        return redirectToLogin();
      }

      alert(err?.message || "Erreur lors de la mise à jour des favoris.");
    } finally {
      btn.classList.remove("disabled");
    }
  });
}

async function renderProductGrid() {
  const products = await fetchProducts();
  const grid = document.getElementById("product-grid");

  products.forEach((product) => {
    // 1️⃣ construire le bloc HTML
    const card = buildProductHTML(product);
    // 2️⃣ intégrer les listes dynamiques (ex: liste_couleur)
    applyDynamicLists(card, product);
    // rating
    applyRatingStars(card, product);
    applyLabel(card, product);
    // 3️⃣ ajouter dans la grille
    grid.appendChild(card);
  });

  // Active les boutons QuickView maintenant que la grille est générée
  setupQuickViewButtons();
}

document.addEventListener("DOMContentLoaded", async () => {
  wireWishlistToggle();

  // ✅ précharge la wishlist si connecté (sinon no-op)
  await preloadWishlistCodes();

  // rend la grille ensuite (comme ça on peut set l'état des coeurs)
  await renderProductGrid();
});