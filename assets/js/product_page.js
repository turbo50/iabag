import { CONFIG } from "./config.js";
import { getProductByCode, getProductCodeFromUrl } from "./product_service.js";
import {
  getIdToken,
  getUserFromIdToken,
  isAuthenticated,
  setNextUrl,
} from "./auth_social_cognito.js";

console.log("🧭 product_page loaded", { href: location.href, search: location.search });

function joinUrl(base, path) {
  return `${String(base || "").replace(/\/+$/, "")}/${String(path || "").replace(/^\/+/, "")}`;
}

async function readJsonResponse(res) {
  const text = await res.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const message = json?.error || json?.message || text || `${res.status} ${res.statusText}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = json || text;
    throw err;
  }

  return json;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  return readJsonResponse(res);
}

async function fetchJsonAuth(url, { method = "GET", body = null } = {}) {
  const token = getIdToken();
  if (!token) {
    const err = new Error("Utilisateur non authentifié");
    err.status = 401;
    throw err;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  return readJsonResponse(res);
}

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

function getProductReturnUrl(code) {
  if (code) {
    return `product-detail.html?code=${encodeURIComponent(code)}#reviews`;
  }

  const current = `${window.location.pathname}${window.location.search}${window.location.hash || "#reviews"}`;
  return current;
}

function redirectToLoginForReviews(code) {
  setNextUrl(getProductReturnUrl(code));
  window.location.href = "login.html";
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

function normalizeOneColor(color) {
  if (!color) return null;

  if (typeof color === "string") {
    return {
      name: color,
      cssClass: color.toLowerCase(),
    };
  }

  if (color.name || color.cssClass) {
    return {
      name: color.name || "",
      cssClass: color.cssClass || (color.name ? String(color.name).toLowerCase() : ""),
    };
  }

  if (color.M) {
    return {
      name: color.M?.name?.S || "",
      cssClass: color.M?.cssClass?.S || "",
    };
  }

  return null;
}

function normalizeColorList(colors) {
  const list = Array.isArray(colors) ? colors : (colors?.L || []);

  return list
    .map(normalizeOneColor)
    .filter(Boolean)
    .filter((c) => c.name || c.cssClass);
}

function renderColors(colors) {
  const ul = document.getElementById("p-colors");
  if (!ul) return;

  ul.innerHTML = "";

  const normalizedColors = normalizeColorList(colors);

  normalizedColors.forEach((color, idx) => {
    const name = color.name || "";
    const cssClass = color.cssClass || "";

    const li = document.createElement("li");
    li.className = `swatch-element color available ${idx === 0 ? "active" : ""}`.trim();

    li.innerHTML = `
      <label class="rounded-0 swatchLbl small color ${cssClass}" title="${name}"></label>
      <span class="tooltip-label top">${name}</span>
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

function renderTopReviewSummaryFromProduct(p) {
  const rating =
    p?.notation ??
    p?.rating ??
    p?.note ??
    p?.average_rating ??
    p?.moyenne_avis ??
    0;

  const count =
    p?.nombre_avis ??
    p?.nb_avis ??
    p?.reviews_count ??
    p?.avis_count ??
    0;

  renderTopReviewSummary(rating, count);
}

function renderTopReviewSummary(rating, count) {
  const topStars = document.getElementById("p-top-review-stars");
  const topLabel = document.getElementById("p-top-review-label");
  const topWrapper = document.getElementById("p-top-review");

  renderRatingStars(topStars, rating);

  if (topWrapper) {
    topWrapper.setAttribute("data-rating", String(rating ?? 0));
  }

  if (topLabel) {
    const n = Number(count || 0);
    topLabel.textContent = n > 0 ? `${n} avis` : "Avis";
  }

  const sectionStars = document.getElementById("reviews-summary-stars");
  const sectionLabel = document.getElementById("reviews-summary-label");

  renderRatingStars(sectionStars, rating);

  if (sectionLabel) {
    const n = Number(count || 0);
    if (n > 0) {
      const average = Number(rating || 0).toFixed(1).replace(".", ",");
      sectionLabel.textContent = `${n} avis • note moyenne ${average}/5`;
    } else {
      sectionLabel.textContent = "Aucun avis pour ce produit";
    }
  }
}

function formatReviewDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function reviewStarsHtml(rating) {
  const safeRating = Number(rating);
  const normalized = Number.isFinite(safeRating) ? Math.max(0, Math.min(5, safeRating)) : 0;

  const fullStars = Math.floor(normalized);
  const halfStar = normalized % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

  let html = "";

  for (let i = 0; i < fullStars; i++) html += '<i class="icon an an-star"></i>';
  if (halfStar) html += '<i class="icon an an-star-half-o"></i>';
  for (let i = 0; i < emptyStars; i++) html += '<i class="icon an an-star-o"></i>';

  return html;
}

function renderReviews(items) {
  const listEl = document.getElementById("reviews-list");
  const emptyEl = document.getElementById("reviews-empty");
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = "";

  const reviews = Array.isArray(items) ? items : [];

  if (!reviews.length) {
    emptyEl.style.display = "";
    renderTopReviewSummary(0, 0);
    return;
  }

  emptyEl.style.display = "none";

  const total = reviews.reduce((sum, item) => sum + Number(item?.rating ?? item?.note ?? 0), 0);
  const average = reviews.length ? total / reviews.length : 0;
  renderTopReviewSummary(average, reviews.length);

  reviews.forEach((review) => {
    const title = String(review?.titre || "").trim() || "Avis client";
    const pseudo = String(review?.pseudo || "Client").trim();
    const dateAvis = formatReviewDate(review?.date_avis);
    const commentaire = String(review?.commentaire || "").trim();
    const rating = Number(review?.rating ?? review?.note ?? 0);

    const article = document.createElement("div");
    article.className = "spr-review";
    article.innerHTML = `
      <div class="spr-review-header">
        <span class="product-review spr-starratings">
          <span class="reviewLink">${reviewStarsHtml(rating)}</span>
        </span>
        <h5 class="spr-review-header-title mt-1">${title}</h5>
        <span class="spr-review-header-byline"><strong>${pseudo}</strong>${dateAvis ? ` le <strong>${dateAvis}</strong>` : ""}</span>
      </div>
      <div class="spr-review-content">
        <p class="spr-review-content-body">${commentaire || ""}</p>
      </div>
    `;
    listEl.appendChild(article);
  });
}

function getSelectedRating() {
  const checked = document.querySelector('input[name="rating"]:checked');
  if (!checked) return 0;

  const raw = String(checked.id || "");
  const match = raw.match(/rating-(\d+)/);
  return match ? Number(match[1]) : 0;
}

function resetReviewFormKeepIdentity() {
  const titleInput = document.getElementById("review");
  const messageInput = document.getElementById("message");

  if (titleInput) titleInput.value = "";
  if (messageInput) messageInput.value = "";

  document.querySelectorAll('input[name="rating"]').forEach((el) => {
    el.checked = false;
  });
}

function setReviewFeedback(message, isError = false) {
  const el = document.getElementById("reviews-feedback");
  if (!el) return;
  el.textContent = message || "";
  el.style.color = isError ? "#b00020" : "#198754";
}

function setReviewFormAlert(message, isError = false) {
  const el = document.getElementById("review-form-alert");
  if (!el) return;
  el.textContent = message || "";
  el.style.color = isError ? "#b00020" : "";
}

function applyAuthenticatedProfile(profile) {
  const pseudoInput = document.getElementById("nickname");
  const emailInput = document.getElementById("email");
  const user = getUserFromIdToken();
  const email = user?.email || "";

  if (pseudoInput) {
    pseudoInput.value = profile?.pseudo || "";
    pseudoInput.readOnly = true;
    pseudoInput.setAttribute("readonly", "readonly");
    pseudoInput.style.backgroundColor = "#f5f5f5";
  }

  if (emailInput && email) {
    emailInput.value = email;
    emailInput.readOnly = true;
    emailInput.setAttribute("readonly", "readonly");
    emailInput.style.backgroundColor = "#f5f5f5";
  }

  if (!profile?.pseudo) {
    setReviewFormAlert("Pseudo introuvable dans votre profil. Complétez d’abord votre inscription.", true);
  } else {
    setReviewFormAlert("");
  }
}

function wireReviewGuards(productCode) {
  const writeBtn = document.getElementById("write-review-btn");
  const form = document.getElementById("review-form");

  if (writeBtn) {
    writeBtn.addEventListener("click", (e) => {
      e.preventDefault();

      if (!isAuthenticated()) {
        redirectToLoginForReviews(productCode);
        return;
      }

      form?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("message")?.focus();
    });
  }

  ["nickname", "email", "review", "message"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("focus", () => {
      if (!isAuthenticated()) {
        redirectToLoginForReviews(productCode);
      }
    });
  });
}

async function loadProfileIfAuthenticated() {
  if (!isAuthenticated()) return null;

  const url = joinUrl(CONFIG.API_BASE_URL, "/clients/me/profile");
  try {
    return await fetchJsonAuth(url, { method: "GET" });
  } catch (err) {
    console.warn("Impossible de charger le profil client", err);
    return null;
  }
}

async function loadReviews(productCode) {
  const url = joinUrl(
    CONFIG.API_BASE_URL,
    `/products/${encodeURIComponent(productCode)}/reviews?limit=50`
  );
  const data = await fetchJson(url, { method: "GET" });
  return Array.isArray(data?.items) ? data.items : [];
}

async function submitReview(productCode) {
  if (!isAuthenticated()) {
    redirectToLoginForReviews(productCode);
    return;
  }

  const profile = await loadProfileIfAuthenticated();
  if (!profile?.pseudo) {
    setReviewFormAlert("Impossible de publier : pseudo introuvable dans votre profil.", true);
    return;
  }

  const rating = getSelectedRating();
  const titre = String(document.getElementById("review")?.value || "").trim();
  const commentaire = String(document.getElementById("message")?.value || "").trim();
  const email = String(document.getElementById("email")?.value || "").trim();

  if (!rating) {
    setReviewFeedback("Merci de sélectionner une note.", true);
    return;
  }

  if (!commentaire) {
    setReviewFeedback("Merci de saisir le texte de votre avis.", true);
    return;
  }

  const submitBtn = document.getElementById("review-submit-btn");
  if (submitBtn) submitBtn.disabled = true;
  setReviewFeedback("");

  try {
    const url = joinUrl(
      CONFIG.API_BASE_URL,
      `/products/${encodeURIComponent(productCode)}/reviews`
    );

    await fetchJsonAuth(url, {
      method: "POST",
      body: {
        rating,
        note: rating,
        titre,
        commentaire,
        email,
      },
    });

    resetReviewFormKeepIdentity();
    setReviewFeedback("Votre avis a bien été enregistré.");

    const items = await loadReviews(productCode);
    renderReviews(items);
  } catch (err) {
    if (err?.status === 401) {
      redirectToLoginForReviews(productCode);
      return;
    }
    setReviewFeedback(err?.message || "Erreur lors de l'enregistrement de l'avis.", true);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function wireReviewForm(productCode) {
  const form = document.getElementById("review-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitReview(productCode);
  });
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
  renderTopReviewSummaryFromProduct(p);
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

  wireReviewGuards(code);
  wireReviewForm(code);

  const product = await getProductByCode(code);
  if (!product) {
    setText("p-title", "Produit introuvable");
    return;
  }

  injectProduct(product);

  try {
    const reviews = await loadReviews(code);
    renderReviews(reviews);
  } catch (err) {
    console.error("Erreur chargement avis", err);
    renderReviews([]);
    setReviewFeedback("Impossible de charger les avis pour le moment.", true);
  }

  if (isAuthenticated()) {
    const profile = await loadProfileIfAuthenticated();
    applyAuthenticatedProfile(profile);
  } else {
    setReviewFormAlert("Connectez-vous pour laisser un avis.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((e) => console.error(e));
});