import { getProductByCode } from "./product_service.js";
import { addItem } from "./cart_service.js";
import { getSelectedProductCode } from "./product_code_from_session.js";

function getSelectedColor() {
  const active = document.querySelector("#p-colors li.active");
  return active?.dataset?.value || active?.getAttribute?.("data-value") || "";
}

async function onSubmit(e) {
  const btn = e.submitter;
  const isAdd = btn && btn.classList.contains("product-form__cart-submit");
  if (!isAdd) return;

  e.preventDefault();

  const code = getSelectedProductCode();
  if (!code) {
    console.error("Ajout panier: selected_product_code absent dans sessionStorage.");
    return;
  }

  const product = await getProductByCode(code);
  if (!product) {
    console.error("Ajout panier: produit introuvable", { code });
    return;
  }

  const color = getSelectedColor();
  const domImg = getMainProductImageFromDom();
  const image = product.image_principale || product.image || domImg || ""; 
  addItem({
    id: product.code_produit || code,
    title: product.nom_produit || "Produit",
    variant: color ? `Couleur: ${color}` : "",
    price: product.prix_actuel || 0,
    qty: 1,
    image,
    url: "product-detail.html", // pas de ?code= chez toi
  });

  // Ouvrir le mini-cart automatiquement (optionnel)
  const drawerEl = document.getElementById("minicart-drawer");
  if (drawerEl && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(drawerEl).show();
  }
}

function getMainProductImageFromDom() {
  // courant sur ta page produit (zoom)
  const zoom = document.getElementById("zoompro");
  const src = zoom?.getAttribute("src") || zoom?.getAttribute("data-src");
  if (src) return src;

  // fallback générique
  const any = document.querySelector(".product-details-img img, .product-thumb img, img");
  return any?.getAttribute("src") || any?.getAttribute("data-src") || "";
}

function init() {
  const form = document.querySelector("form.product-form");
  if (!form) {
    console.warn("add_to_cart_product: form.product-form introuvable");
    return;
  }
  form.addEventListener("submit", onSubmit);
}

document.addEventListener("DOMContentLoaded", init);