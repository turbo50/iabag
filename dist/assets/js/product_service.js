import { CONFIG } from "./config.js";

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

export function getProductCodeFromUrl() {
  // on accepte ?code=... ou ?code_produit=...
  return getQueryParam("code") || getQueryParam("code_produit");
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function getProductFromMock(codeProduit) {
  const list = await fetchJson(CONFIG.MOCK_PRODUCTS_URL);
  const product = (Array.isArray(list) ? list : []).find((p) => p.code_produit === codeProduit);
  return product || null;
}

async function getProductFromApi(codeProduit) {
  // API attendue: GET {API_BASE_URL}/products/{code}
  const url = `${CONFIG.API_BASE_URL.replace(/\/$/, "")}/products/${encodeURIComponent(codeProduit)}`;
  return await fetchJson(url);
}

/**
 * Retourne un produit (objet) ou null.
 */
export async function getProductByCode(codeProduit) {
  if (!codeProduit) return null;
  if (CONFIG.USE_MOCK) return await getProductFromMock(codeProduit);
  return await getProductFromApi(codeProduit);
}