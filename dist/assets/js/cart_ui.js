import { getCart, getCartCount, getCartSubtotal, formatMoney, saveCart } from "./cart_service.js";

/** Met à jour le badge compteur dans le header */
export function renderHeaderCartCount(cart = getCart()) {
  const count = getCartCount(cart);

  document.querySelectorAll(".site-cart-count").forEach((el) => {
    el.textContent = String(count);
  });

  const countEl = document.getElementById("minicart-count");
  if (countEl) countEl.textContent = String(count);
}

/** Rend la liste des items dans le minicart drawer */
export function renderMiniCart(cart = getCart()) {
  const ul = document.getElementById("minicart-items");
  const tpl = document.getElementById("minicart-item-tpl");
  const empty = document.getElementById("minicart-empty");
  const subtotalEl = document.getElementById("minicart-subtotal");

  if (!ul || !tpl) return; // drawer pas présent sur la page

  ul.innerHTML = "";

  const items = cart.items || [];

  if (empty) empty.style.display = items.length ? "none" : "";
  if (subtotalEl) subtotalEl.textContent = formatMoney(getCartSubtotal(cart));

  items.forEach((it, index) => {
    const frag = tpl.content.cloneNode(true);
    const li = frag.querySelector("li.item");
    if (!li) return;

    // identifiant de ligne (simple)
    li.dataset.lineId = String(index);

    const aImg = li.querySelector("a.product-image");
    const img = li.querySelector("img");
    const aTitle = li.querySelector("a.product-title");
    const variant = li.querySelector(".variant-cart");
    const money = li.querySelector(".money");
    const qtyInput = li.querySelector("input.qty");

const finalImg = resolveImageUrl(it.image);

if (img) {
  img.alt = it.title || "product";

  // 1) src direct (pour affichage immédiat)
  img.src = finalImg || "";

  // 2) data-src (pour ton système lazyload)
  img.setAttribute("data-src", finalImg || "");

  // 3) certains plugins regardent data-original / data-lazy etc.
  img.setAttribute("data-original", finalImg || "");
}
    if (aTitle) {
      aTitle.textContent = it.title || "";
      aTitle.href = it.url || "#";
    }
    if (variant) variant.textContent = it.variant || "";
    if (money) money.textContent = formatMoney(it.price || 0);
    if (qtyInput) qtyInput.value = String(it.qty || 1);

    ul.appendChild(frag);
  });

  renderHeaderCartCount(cart);
}

function resolveImageUrl(src) {
  if (!src) return "";
  try {
    // transforme "assets/..." ou "images/..." en URL utilisable
    return new URL(src, window.location.href).toString();
  } catch {
    return src;
  }
}

/** Délégation d’événements + / - / remove dans le drawer */
function bindMiniCartActions() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.("[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const li = btn.closest("li.item");
    const lineId = li?.dataset?.lineId;
    if (lineId == null) return;

    const cart = getCart();
    const idx = Number(lineId);
    const item = cart.items?.[idx];
    if (!item) return;

    if (action === "inc") {
      item.qty = (Number(item.qty) || 1) + 1;
      saveCart(cart);
      renderMiniCart(cart);
    }

    if (action === "dec") {
      item.qty = Math.max(1, (Number(item.qty) || 1) - 1);
      saveCart(cart);
      renderMiniCart(cart);
    }

    if (action === "remove") {
      cart.items.splice(idx, 1);
      saveCart(cart);
      renderMiniCart(cart);
    }
  });
}

function bindMiniCartOpenRefresh() {
  // Bootstrap 5 modal event: "show.bs.modal"
  const drawerEl = document.getElementById("minicart-drawer");
  if (!drawerEl) return;

  drawerEl.addEventListener("show.bs.modal", () => {
    renderMiniCart(getCart());
  });
}

export function initCartUI() {
  // 1) rendu initial (badge header) au chargement
  renderHeaderCartCount(getCart());

  // 2) actions dans le minicart
  bindMiniCartActions();

  // 3) refresh à l’ouverture du modal
  bindMiniCartOpenRefresh();

  // 4) refresh quand le panier change (CustomEvent depuis cart_service.js)
  window.addEventListener("cart:changed", (ev) => {
    const cart = ev?.detail?.cart || getCart();
    renderHeaderCartCount(cart);
    // si le drawer est présent, on peut aussi le rerender (utile si le drawer est ouvert)
    renderMiniCart(cart);
  });
}

document.addEventListener("DOMContentLoaded", initCartUI);