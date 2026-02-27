import { CONFIG } from "./config.js";
import { getProductByCode, getProductCodeFromUrl } from "./product_service.js";
import { rebindProductTabs } from "./product_tabs_fix.js";

console.log("🧭 product_page loaded", { href: location.href, search: location.search });

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return "";
  return new Intl.NumberFormat(CONFIG.LOCALE, { style: "currency", currency: CONFIG.CURRENCY }).format(Number(value));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
}

function setAttr(id, attr, value) {
  const el = document.getElementById(id);
  if (el && value != null) el.setAttribute(attr, value);
}

function show(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = visible ? "" : "none";
}

function renderColors(colors) {
  const ul = document.getElementById("p-colors");
  if (!ul) return;

  ul.innerHTML = "";

  (colors || []).forEach((c, idx) => {
    const li = document.createElement("li");
    li.className = `swatch-element color ${c.cssClass || ""} available ${idx === 0 ? "active" : ""}`;
    li.dataset.value = c.name || "";

    li.innerHTML = `
      <label class="swatchLbl rounded color xlarge ${c.cssClass || ""}" title="${c.name || ""}"></label>
      <span class="tooltip-label top">${c.name || ""}</span>
    `;

    li.addEventListener("click", () => {
      ul.querySelectorAll("li").forEach((x) => x.classList.remove("active"));
      li.classList.add("active");
    });

    ul.appendChild(li);
  });
}

function renderGallery(mainImage, otherImages) {
  const gallery = document.getElementById("gallery");
  const lightbox = document.getElementById("p-lightbox");
  if (!gallery || !lightbox) return;

  const images = [mainImage, ...(otherImages || [])].filter(Boolean);

  gallery.innerHTML = "";
  lightbox.innerHTML = "";

  images.forEach((src, i) => {
    const a = document.createElement("a");
    a.setAttribute("data-image", src);
    a.setAttribute("data-zoom-image", src);
    a.className = `slick-slide ${i === 0 ? "active" : ""}`;
    a.innerHTML = `<img class="blur-up lazyload" data-src="${src}" src="${src}" alt="product" />`;

    a.addEventListener("click", (e) => {
      e.preventDefault();
      setAttr("zoompro", "src", src);
      setAttr("zoompro", "data-zoom-image", src);
    });

    gallery.appendChild(a);

    const lb = document.createElement("a");
    lb.href = src;
    lb.dataset.size = "1000x1280"; // tu pourras calculer plus tard
    lightbox.appendChild(lb);
  });

  if (images[0]) {
    setAttr("zoompro", "src", images[0]);
    setAttr("zoompro", "data-zoom-image", images[0]);
  }
}

function renderPrices(p) {
  setText("p-price", formatMoney(p.prix_actuel));
  setText("p-oldprice", p.ancien_prix ? formatMoney(p.ancien_prix) : "");

  const hasDiscount = p.ancien_prix && p.prix_actuel && Number(p.ancien_prix) > Number(p.prix_actuel);
  show("p-discount", !!hasDiscount);

  if (hasDiscount) {
    const save = Number(p.ancien_prix) - Number(p.prix_actuel);
    const rate = Math.round((save / Number(p.ancien_prix)) * 100);
    setText("p-save", formatMoney(save));
    setText("p-save-rate", String(rate));
  }
}

/**
 * Injecte le produit dans la page.
 * Nécessite que la page ait des IDs (voir plus bas).
 */
export function injectProduct(p) {
  // titre + SEO
  setText("p-title", p.nom_produit || "Produit");
  document.title = `${p.nom_produit || "Produit"} - IA BAG`;

  // infos
  setText("p-brand", p.marque_produit);
  setText("p-name", p.nom_produit);
  setText("p-sku", p.sku);

  // prix
  renderPrices(p);

  // couleurs + galerie
  renderColors(p.liste_couleur);
  renderGallery(p.image_produit, p.autres_images);
}

async function init() {
  const code = getProductCodeFromUrl();
  if (!code) {
    console.warn("Paramètre manquant: ?code=P006");
    setText("p-title", "Produit introuvable");
    return;
  }

  const product = await getProductByCode(code);
  if (!product) {
    setText("p-title", "Produit introuvable");
    return;
  }

  injectProduct(product);
  rebindProductTabs();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((e) => console.error(e));
});