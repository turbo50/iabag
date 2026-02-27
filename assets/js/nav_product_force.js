/**
 * Force la navigation vers product-layout1.html?code=XXX en contournant les handlers du thème
 * (quickview, overlays, preventDefault, etc.)
 *
 * Pré-requis recommandé:
 * - Chaque carte produit (.item) doit avoir dataset.code = product.code_produit
 *   (voir buildProductHTML dans load_product_grill.js)
 *
 * Ce script:
 * - écoute les clics en "capture" (donc avant plugins.js/main.js)
 * - ignore les boutons d'action (quickview, wishlist, compare, cart)
 * - récupère le code produit depuis:
 *    1) un élément cliqué avec [data-code]
 *    2) la card .item via data-code
 *    3) un bouton [data-product-id] dans la card
 * - stocke le dernier code dans sessionStorage (fallback)
 * - navigue en HARD vers /product-layout1.html?code=...
 */

console.log("✅ nav_product_force.js chargé", { href: location.href });

function findCard(target) {
  return target?.closest?.("#product-grid .item, .grid-products .item, .item") || null;
}

function isActionClick(target) {
  // Ne pas casser les actions du thème (quickview, add to cart, etc.)
  return !!target?.closest?.(
    [
      "[data-product-id]", // quickview button
      ".quick-view",
      ".quick-view-popup",
      ".pro-quickshop-popup",
      ".cartIcon",
      ".add-to-wishlist",
      ".add-to-compare",
      ".wishlist",
      ".compare",
      ".button-set a",
      ".button-set button",
    ].join(",")
  );
}

function getCodeFromTargetOrCard(target, card) {
  // 1) élément cliqué (ou parent) avec data-code
  const fromTarget = target?.closest?.("[data-code]")?.dataset?.code;
  if (fromTarget) return fromTarget;

  // 2) data-code sur la card
  const fromCard = card?.dataset?.code;
  if (fromCard) return fromCard;

  // 3) bouton quickview data-product-id
  const qv = card?.querySelector?.("[data-product-id]");
  const fromQv = qv?.getAttribute?.("data-product-id");
  if (fromQv) return fromQv;

  // 4) (optionnel) lire ?code= d’un href existant dans la card
  const a = card?.querySelector?.('a[href*="product-layout1"]');
  if (a) {
    try {
      const u = new URL(a.getAttribute("href"), location.href);
      return u.searchParams.get("code") || u.searchParams.get("code_produit");
    } catch {
      // ignore
    }
  }

  return null;
}

function buildProductUrl(code) {
  // IMPORTANT: on force .html (car tu constates une navigation vers /product-layout1)
  return `${location.origin}/product-layout1.html?code=${encodeURIComponent(code)}`;
}

document.addEventListener(
  "click",
  (e) => {
    // Ne traiter que les clics "normaux"
    // (tu peux enlever ce garde si besoin)
    if (e.button !== 0) return;

    const card = findCard(e.target);
    if (!card) return;

    // Laisse vivre les actions (quickview / wishlist / compare / cart)
    if (isActionClick(e.target)) return;

    const code = getCodeFromTargetOrCard(e.target, card);
    if (!code) {
      console.warn("⚠️ Click produit détecté mais code introuvable", { target: e.target, card });
      return;
    }

    // Fallback utile si un script enlève le querystring plus tard
    try {
      sessionStorage.setItem("last_product_code", String(code));
    } catch {
      // ignore
    }

    const url = buildProductUrl(code);
    console.log("➡️ NAV FORCÉE:", url);

    // On bloque le thème
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

    // Navigation "hard"
    location.href = url;
  },
  true // capture
);