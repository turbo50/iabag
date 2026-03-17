import { CONFIG } from "./config.js";
import { getIdToken, isAuthenticated } from "./auth_social_cognito.js";

function joinUrl(base, path) {
  return `${String(base).replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`;
}

async function postJson(url, body, token) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.error || json?.message || text || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = json || text;
    throw err;
  }

  return json;
}

/**
 * Crée une commande à partir du panier.
 * cart.items: [{ id, qty, ... }]
 * API attend: { items: [{ code_produit, quantite }] }
 */
export async function createOrderFromCart(cart) {
  if (!CONFIG?.API_BASE_URL) throw new Error("CONFIG.API_BASE_URL manquant");
  if (!cart?.items?.length) throw new Error("Panier vide.");

  if (!isAuthenticated()) {
    const err = new Error("NOT_AUTHENTICATED");
    err.code = "NOT_AUTHENTICATED";
    throw err;
  }

  const token = getIdToken();
  if (!token) {
    const err = new Error("NOT_AUTHENTICATED");
    err.code = "NOT_AUTHENTICATED";
    throw err;
  }

  const items = cart.items
    .filter((it) => it?.id && Number(it.qty) > 0)
    .map((it) => ({
      code_produit: String(it.id),
      quantite: Number(it.qty) || 1,
    }));

  if (!items.length) throw new Error("Panier vide.");

  const url = joinUrl(CONFIG.API_BASE_URL, "/orders");
  return await postJson(url, { items }, token);
}