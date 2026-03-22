/**
 * POST /products/{code}/reviews  (protected — Cognito JWT requis)
 *
 * Body JSON attendu :
 *   {
 *     rating: number (1-5),
 *     titre?: string,
 *     commentaire?: string,
 *     email?: string
 *   }
 */

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, badRequest, unauthorized, internalError } from "../shared/response.js";
import { requireSub } from "../shared/auth.js";

const TABLE_AVIS = process.env.TABLE_AVIS;
const TABLE_CLIENT = process.env.TABLE_CLIENT;
const GEOIP_BASE_URL = process.env.GEOIP_BASE_URL || "https://ipapi.co";

function safeString(value) {
  return String(value || "").trim();
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
    const codeProduit = decodeURIComponent(event.pathParameters?.code || "");
    if (!codeProduit) return badRequest("code_produit manquant");

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return badRequest("Corps JSON invalide");
    }

    const rating = Number(body.rating ?? body.note);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return badRequest("rating doit être un entier entre 1 et 5");
    }

    const titre = safeString(body.titre ?? body.review);
    const commentaire = safeString(body.commentaire ?? body.message);
    const email = safeString(body.email);

    if (!commentaire) return badRequest("commentaire manquant");
    if (commentaire.length > 5000) return badRequest("commentaire trop long");
    if (titre.length > 150) return badRequest("titre trop long");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return badRequest("email invalide");
    }

    const clientResult = await db.send(
      new GetCommand({
        TableName: TABLE_CLIENT,
        Key: { code_client: codeClient },
      })
    );

    const pseudo = safeString(clientResult?.Item?.pseudo);
    if (!pseudo) {
      return badRequest("Pseudo client introuvable. Complète d’abord ton profil.");
    }

    const dateAvis = new Date().toISOString();
    const reviewKey = `${dateAvis}#${codeClient}`;
    const ipAddress = getClientIp(event);
    const geo = await resolveCountry(event, "iabag-reviews/1.0");

    const item = {
      code_produit: codeProduit,
      review_key: reviewKey,
      code_client: codeClient,
      pseudo,
      date_avis: dateAvis,
      rating,
      note: rating,
      titre,
      commentaire,
      email,
      ip_address: ipAddress,
      country_code: geo.country_code || "",
      country_name: geo.country_name || "",
      geo_source: geo.geo_source || "",
    };

    await db.send(
      new PutCommand({
        TableName: TABLE_AVIS,
        Item: item,
      })
    );

    return ok(item);
  } catch (err) {
    if (err?.statusCode === 401) return unauthorized();
    console.error("reviews_put error:", err);
    return internalError();
  }
}