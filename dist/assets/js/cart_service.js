import { CONFIG } from "./config.js";

const CART_KEY = "iabag_cart_v1";

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function getCart() {
  const raw = localStorage.getItem(CART_KEY);
  const cart = raw ? safeParse(raw, null) : null;
  return cart && Array.isArray(cart.items) ? cart : { items: [] };
}

export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent("cart:changed", { detail: { cart } }));
}

export function addItem(item) {
  const cart = getCart();

  const id = String(item.id);
  const variant = String(item.variant || "");
  const qtyToAdd = Math.max(1, Number(item.qty) || 1);

  const existing = cart.items.find((x) => String(x.id) === id && String(x.variant || "") === variant);

  if (existing) {
    existing.qty = (Number(existing.qty) || 0) + qtyToAdd;
  } else {
    cart.items.push({
      id,
      title: item.title || "",
      variant,
      price: Number(item.price) || 0,
      qty: qtyToAdd,
      image: item.image || "",
      url: item.url || "",
    });
  }

  saveCart(cart);
  return cart;
}

export function getCartCount(cart = getCart()) {
  return (cart.items || []).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
}

export function getCartSubtotal(cart = getCart()) {
  return (cart.items || []).reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
}

/** ✅ AJOUT: exporter formatMoney */
export function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return "";
  return new Intl.NumberFormat(CONFIG.LOCALE, { style: "currency", currency: CONFIG.CURRENCY }).format(Number(value));
}