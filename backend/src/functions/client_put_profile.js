import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, badRequest, internalError } from "../shared/response.js";

const TABLE = process.env.TABLE_CLIENT;
const GEOIP_BASE_URL = process.env.GEOIP_BASE_URL || "https://ipapi.co";

function normalizePseudo(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function validatePseudo(pseudo) {
  if (!pseudo) return "Pseudo manquant";
  if (pseudo.length < 2) return "Pseudo trop court";
  if (pseudo.length > 50) return "Pseudo trop long";
  if (!/^[A-Za-z0-9À-ÖØ-öø-ÿ._ -]+$/.test(pseudo)) return "Pseudo invalide";
  return "";
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
    const auth = event.requestContext?.authorizer?.jwt;
    const sub = auth?.claims?.sub;
    if (!sub) return badRequest("Non autorisé (pas de sub Cognito)");

    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return badRequest("Corps JSON invalide");
    }

    const pseudo = normalizePseudo(payload.pseudo);
    const error = validatePseudo(pseudo);
    if (error) return badRequest(error);

    const ipAddress = getClientIp(event);
    const geo = await resolveCountry(event, "iabag-client-profile/1.0");

    await db.send(
      new PutItemCommand({
        TableName: TABLE,
        Item: {
          code_client: { S: sub },
          pseudo: { S: pseudo },
          ip_address: { S: ipAddress || "" },
          country_code: { S: geo.country_code || "" },
          country_name: { S: geo.country_name || "" },
          geo_source: { S: geo.geo_source || "" },
        },
      })
    );

    return ok({
      code_client: sub,
      pseudo,
      country_code: geo.country_code || "",
      country_name: geo.country_name || "",
    });
  } catch (err) {
    console.error("PutClientProfile error", err);
    return internalError();
  }
}