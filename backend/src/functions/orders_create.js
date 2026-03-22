/**
 * POST /orders  (protected — Cognito JWT requis)
 */

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import {
  created,
  badRequest,
  unauthorized,
  notFound,
  internalError,
} from "../shared/response.js";
import { requireSub } from "../shared/auth.js";

const TABLE_PRODUIT = process.env.TABLE_PRODUIT;
const TABLE_COMMANDE = process.env.TABLE_COMMANDE;
const GEOIP_BASE_URL = process.env.GEOIP_BASE_URL || "https://ipapi.co";

function generateOrderCode() {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CMD-${ts}-${rand}`;
}

function getHeader(headers, name) {
  if (!headers) return "";
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || "";
}

function getClientIp(event) {
  const sourceIp = event?.requestContext?.http?.sourceIp;
  if (sourceIp) return String(sourceIp).trim();

  const xff = getHeader(event?.headers, "x-forwarded-for");
  if (!xff) return "";

  return String(xff).split(",")[0].trim();
}

function getCloudFrontCountry(event) {
  return String(getHeader(event?.headers, "cloudfront-viewer-country") || "")
    .trim()
    .toUpperCase();
}

function mapCountryNameFromCode(code) {
  if (!code) return "";
  try {
    const display = new Intl.DisplayNames(["fr"], { type: "region" });
    return display.of(code) || "";
  } catch {
    return "";
  }
}

async function resolveCountryFromIp(ip, userAgentTag) {
  if (!ip) {
    return { country_code: "", country_name: "", geo_source: "" };
  }

  try {
    const base = GEOIP_BASE_URL.replace(/\/+$/, "");
    const res = await fetch(`${base}/${encodeURIComponent(ip)}/json/`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": userAgentTag,
      },
    });

    if (!res.ok) {
      return { country_code: "", country_name: "", geo_source: "" };
    }

    const data = await res.json();
    return {
      country_code: String(data?.country_code || "").toUpperCase(),
      country_name: String(data?.country_name || ""),
      geo_source: "ipapi",
    };
  } catch (err) {
    console.warn("resolveCountryFromIp failed", err);
    return { country_code: "", country_name: "", geo_source: "" };
  }
}

async function resolveCountry(event, userAgentTag) {
  const cfCode = getCloudFrontCountry(event);
  if (cfCode) {
    return {
      country_code: cfCode,
      country_name: mapCountryNameFromCode(cfCode),
      geo_source: "cloudfront",
    };
  }

  const ip = getClientIp(event);
  return resolveCountryFromIp(ip, userAgentTag);
}

export async function handler(event) {
  try {
    const codeClient = requireSub(event);

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return badRequest("Corps JSON invalide");
    }

    const rawItems = body.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return badRequest("items doit être un tableau non vide");
    }

    const lignes = [];
    for (const ligne of rawItems) {
      const code_produit = String(ligne?.code_produit || "").trim();
      const quantite = ligne?.quantite;

      if (!code_produit) {
        return badRequest("Chaque item doit avoir un code_produit (string)");
      }

      const qty = parseInt(quantite, 10);
      if (!Number.isInteger(qty) || qty < 1) {
        return badRequest(`quantite invalide pour ${code_produit}`);
      }

      const prodResult = await db.send(
        new GetCommand({
          TableName: TABLE_PRODUIT,
          Key: { code_produit },
          ProjectionExpression: "code_produit, nom_produit, prix_actuel",
        })
      );

      if (!prodResult.Item) {
        return notFound(`Produit introuvable : ${code_produit}`);
      }

      const prix = Number(prodResult.Item.prix_actuel);
      if (!Number.isFinite(prix) || prix < 0) {
        return badRequest(`prix invalide pour ${code_produit}`);
      }

      lignes.push({
        code_produit,
        nom_produit: prodResult.Item.nom_produit || "",
        quantite: qty,
        prix_unitaire: prix,
        montant_ligne: Math.round(prix * qty * 100) / 100,
      });
    }

    const total = Math.round(lignes.reduce((s, l) => s + l.montant_ligne, 0) * 100) / 100;
    const dateCommande = new Date().toISOString();
    const codeCommande = generateOrderCode();
    const ipAddress = getClientIp(event);
    const geo = await resolveCountry(event, "iabag-orders/1.0");

    const commande = {
      code_commande: codeCommande,
      code_client: codeClient,
      date_commande: dateCommande,
      lignes,
      total,
      statut: "en_attente",
      ip_address: ipAddress,
      country_code: geo.country_code || "",
      country_name: geo.country_name || "",
      geo_source: geo.geo_source || "",
    };

    await db.send(
      new PutCommand({
        TableName: TABLE_COMMANDE,
        Item: commande,
        ConditionExpression: "attribute_not_exists(code_commande)",
      })
    );

    return created(commande);
  } catch (err) {
    if (err?.statusCode === 401) return unauthorized();
    console.error("orders_create error:", err);
    return internalError();
  }
}