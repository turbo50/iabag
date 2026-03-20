import { CONFIG } from "./config.js";
import { getProductByCode, getProductCodeFromUrl } from "./product_service.js";

console.log("🧭 product_page loaded", { href: location.href, search: location.search });

function getSelectedProductCode() {
  const fromUrl = getProductCodeFromUrl();
  if (fromUrl) return fromUrl;

  try {
    const fromSession = sessionStorage.getItem("selected_product_code");
    if (fromSession) return fromSession;
  } catch {
    // ignore
  }

  return null;
}

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return "";
  return new Intl.NumberFormat(CONFIG.LOCALE, {
    style: "currency",
    currency: CONFIG.CURRENCY,
  }).format(Number(value));
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

function showEl(el, visible) {
  if (!el) return;
  el.style.display = visible ? "" : "none";
}

function hasValue(v) {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

function renderOptionalFields(p) {
  const labelWrap = document.querySelector(".product-labels");
  const labelSpan = document.querySelector(".product-labels .pr-label1");
  const labelValue = p?.label;

  if (hasValue(labelValue)) {
    if (labelSpan) labelSpan.textContent = String(labelValue);
    showEl(labelWrap, true);
  } else {
    showEl(labelWrap, false);
    if (labelSpan) labelSpan.textContent = "";
  }

  const fromEl = document.querySelector(".product-single__subtitle");
  const fromValue = p?.from ?? p?.From;

  if (hasValue(fromValue)) {
    if (fromEl) fromEl.textContent = String(fromValue);
    showEl(fromEl, true);
  } else {
    showEl(fromEl, false);
    if (fromEl) fromEl.textContent = "";
  }

  const qtyMsg = document.getElementById("quantity_message");
  const qtySpan = qtyMsg?.querySelector(".items");
  const qtyValue = p?.quantite ?? p?.quantité ?? p?.qty;

  const qtyNumber = qtyValue == null ? NaN : Number(qtyValue);
  const showQty = Number.isFinite(qtyNumber) && qtyNumber > 0;

  if (showQty) {
    if (qtySpan) qtySpan.textContent = String(qtyNumber);
    showEl(qtyMsg, true);
  } else {
    showEl(qtyMsg, false);
    if (qtySpan) qtySpan.textContent = "";
  }
}

function renderDescription(p) {
  const description =
    p?.description ??
    p?.descirption ??
    p?.descriptif ??
    p?.description_produit ??
    "";

  const descEl = document.getElementById("p-description");
  if (!descEl) return;

  descEl.textContent = description;
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
    lb.dataset.size = "1000x1280";
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

  const hasDiscount =
    p.ancien_prix &&
    p.prix_actuel &&
    Number(p.ancien_prix) > Number(p.prix_actuel);

  show("p-discount", !!hasDiscount);

  if (hasDiscount) {
    const save = Number(p.ancien_prix) - Number(p.prix_actuel);
    const rate = Math.round((save / Number(p.ancien_prix)) * 100);
    setText("p-save", formatMoney(save));
    setText("p-save-rate", String(rate));
  }
}

function renderRatingStars(container, rating) {
  if (!container) return;

  container.innerHTML = "";

  const safeRating = Number(rating);
  const normalized = Number.isFinite(safeRating) ? Math.max(0, Math.min(5, safeRating)) : 0;

  const fullStars = Math.floor(normalized);
  const halfStar = normalized % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

  for (let i = 0; i < fullStars; i++) {
    container.innerHTML += '<i class="an an-star"></i>';
  }

  if (halfStar) {
    container.innerHTML += '<i class="an an-star-half-o"></i>';
  }

  for (let i = 0; i < emptyStars; i++) {
    container.innerHTML += '<i class="an an-star-o"></i>';
  }
}

function renderTopReviewSummary(p) {
  const rating =
    p?.notation ??
    p?.rating ??
    p?.note ??
    p?.average_rating ??
    p?.moyenne_avis ??
    0;

  const starsEl = document.getElementById("p-top-review-stars");
  renderRatingStars(starsEl, rating);

  const wrapper = document.getElementById("p-top-review");
  if (wrapper) {
    wrapper.setAttribute("data-rating", String(rating ?? 0));
  }

  const count =
    p?.nombre_avis ??
    p?.nb_avis ??
    p?.reviews_count ??
    p?.avis_count;

  const labelEl = document.getElementById("p-top-review-label");
  if (labelEl) {
    if (Number.isFinite(Number(count)) && Number(count) > 0) {
      const n = Number(count);
      labelEl.textContent = `${n} avis`;
    } else {
      labelEl.textContent = "Avis";
    }
  }
}

export function injectProduct(p) {
  setText("p-title", p.nom_produit || "Produit");
  document.title = `${p.nom_produit || "Produit"} - IA BAG`;

  setText("p-brand", p.marque_produit);
  setText("p-name", p.nom_produit);
  setText("p-sku", p.sku);

  renderDescription(p);
  renderOptionalFields(p);
  renderPrices(p);
  renderTopReviewSummary(p);
  renderColors(p.liste_couleur);
  renderGallery(p.image_produit, p.autres_images);
}

async function init() {
  const code = getSelectedProductCode();

  if (!code) {
    console.warn("Paramètre manquant: ?code=P006 (et aucun selected_product_code en sessionStorage)");
    setText("p-title", "Produit introuvable");
    return;
  }

  const product = await getProductByCode(code);
  if (!product) {
    setText("p-title", "Produit introuvable");
    return;
  }

  injectProduct(product);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((e) => console.error(e));
});