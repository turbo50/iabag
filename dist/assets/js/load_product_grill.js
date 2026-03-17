console.log("✅ load_product_grill.js chargé", { href: location.href });
window.__GRILL_LOADED__ = true;

// Config globale (mock + API Gateway base URL)
import { CONFIG } from "./config.js";

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
    const products = Array.isArray(data) ? data : (data?.items ?? []);
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
  const products = Array.isArray(data) ? data : (data?.items ?? []);
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

  return card;
}

function fillColorList(container, colors) {
  container.innerHTML = "";
  colors.forEach((color) => {
    // Selon le format reçu :
    const name = typeof color === "string" ? color : color.name;
    const cssClass = typeof color === "string" ? color.toLowerCase() : color.cssClass;

    const li = document.createElement("li");
    li.className = `medium radius ${cssClass}`;

    li.innerHTML = `
      <span class="swacth-btn"></span>
      <span class="tooltip-label">${name}</span>
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
  await renderProductGrid();
});

