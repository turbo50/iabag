/**
 * Récupère le code produit stocké par nav_product_force.js
 * sessionStorage.setItem("selected_product_code", String(code));
 */
export function getSelectedProductCode() {
  const v = sessionStorage.getItem("selected_product_code");
  return v && String(v).trim() ? String(v).trim() : null;
}