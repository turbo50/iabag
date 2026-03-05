/**
 * nav_product_force.js
 *
 * Objectif:
 * - Permettre d'ouvrir la page produit correspondante depuis l'index
 *   même si le thème "nettoie" l'URL (supprime .html, querystring, hash, etc.).
 *
 * Stratégie:
 * - On NE dépend PLUS de l'URL pour transporter le code produit.
 * - On stocke le code dans sessionStorage (clé: selected_product_code)
 * - On navigue vers l'URL que ton thème force de toute façon: /product-layout1
 *
 * Côté page produit (product_page.js), il faudra lire sessionStorage
 * si le paramètre ?code=... est absent.
 */

console.log("✅ nav_product_force.js chargé", { href: location.href });

function findCard(target) {
  return target?.closest?.("#product-grid .item, .grid-products .item, .item") || null;
}

function isActionClick(target) {
  // Ne pas casser les actions du thème (quickview, add to cart, etc.)
  return !!target?.closest?.(
    [
      "[data-product-id]", // quickview
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

  // 4) (optionnel) lire ?code= d’un href existant dans la card (si tu en as encore)
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

document.addEventListener(
  "click",
  (e) => {
    // clic gauche seulement
    if (e.button !== 0) return;

    const card = findCard(e.target);
    if (!card) return;

    // Laisse vivre les actions du thème
    if (isActionClick(e.target)) return;

    const code = getCodeFromTargetOrCard(e.target, card);
    if (!code) {
      console.warn("⚠️ Click produit détecté mais code introuvable", { target: e.target, card });
      return;
    }

    // Bloque les handlers du thème
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

    // Stocke le code produit pour la page produit
    try {
      sessionStorage.setItem("selected_product_code", String(code));
    } catch {
      // ignore
    }

    const targetUrl = `${location.origin}/product-layout1`;
    console.log("➡️ NAV (sessionStorage) vers:", targetUrl, "avec code =", code);

    // Navigation "hard"
    location.href = targetUrl;
  },
  true // capture
);