import { getCart, getCartCount, getCartSubtotal, formatMoney, saveCart } from "./cart_service.js";
import { createOrderFromCart } from "./orders_service.js";
import { isAuthenticated, setNextUrl } from "./auth_social_cognito.js";

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

    if (aImg) aImg.href = it.url || "#";
    if (img) {
      img.src = it.image || "";
      img.setAttribute("data-src", it.image || "");
      img.alt = it.title || "product";
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

function closeMiniCartDrawerIfOpen() {
  const drawerEl = document.getElementById("minicart-drawer");
  if (!drawerEl) return;

  // Bootstrap 5
  if (window.bootstrap?.Modal) {
    try {
      window.bootstrap.Modal.getOrCreateInstance(drawerEl).hide();
    } catch {
      // ignore
    }
  }
}

/**
 * ✅ Bind du bouton "Commander"
 *
 * HTML recommandé:
 *   <button data-minicart-checkout class="... proceed-to-checkout">Commander</button>
 *
 * Fallback si tu n'as pas encore ajouté data-minicart-checkout:
 *   on tente aussi .proceed-to-checkout dans #minicart-drawer
 */
function bindMiniCartCheckout() {
  const btn =
    document.querySelector("#minicart-drawer [data-minicart-checkout]") ||
    document.querySelector("#minicart-drawer .proceed-to-checkout");

  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = "1";

  btn.addEventListener("click", async (e) => {
    e.preventDefault();

    const cart = getCart();
    if (!cart.items?.length) {
      alert("Votre panier est vide.");
      return;
    }

    // si pas connecté: mémorise où revenir après login
    if (!isAuthenticated()) {
      setNextUrl(window.location.href);
      window.location.href = "login.html";
      return;
    }

    try {
      btn.disabled = true;

      const order = await createOrderFromCart(cart);

      // vider le panier après succès
      saveCart({ items: [] });

      // fermer le drawer
      closeMiniCartDrawerIfOpen();

      // redirection page succès (à adapter si besoin)
      const code = order?.code_commande ? encodeURIComponent(order.code_commande) : "";
      window.location.href = code ? `checkout-success.html?code=${code}` : "checkout-success.html";
    } catch (err) {
      console.error("Minicart checkout error:", err);

      // si 401 => re-login
      if (err?.status === 401 || err?.code === "NOT_AUTHENTICATED") {
        setNextUrl(window.location.href);
        window.location.href = "login.html";
        return;
      }

      alert(`Impossible de passer la commande : ${err?.message || err}`);
    } finally {
      btn.disabled = false;
    }
  });
}

export function initCartUI() {
  // 1) rendu initial (badge header) au chargement
  renderHeaderCartCount(getCart());

  // 2) actions dans le minicart
  bindMiniCartActions();

  // 3) refresh à l’ouverture du modal
  bindMiniCartOpenRefresh();

  // 4) bind checkout
  bindMiniCartCheckout();

  // 5) refresh quand le panier change (CustomEvent depuis cart_service.js)
  window.addEventListener("cart:changed", (ev) => {
    const cart = ev?.detail?.cart || getCart();
    renderHeaderCartCount(cart);
    renderMiniCart(cart);
  });
}

document.addEventListener("DOMContentLoaded", initCartUI);