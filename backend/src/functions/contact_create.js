import { randomUUID } from "crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";

const TABLE_CONTACT = process.env.TABLE_CONTACT;
const GEOIP_BASE_URL = process.env.GEOIP_BASE_URL || "https://ipapi.co";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type,Authorization",
      "access-control-allow-methods": "POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function ok(body) {
  return json(200, body);
}

function badRequest(message, details = null) {
  return json(400, {
    error: message,
    ...(details ? { details } : {}),
  });
}

function internalError() {
  return json(500, { error: "Erreur interne du serveur" });
}

function sanitizeSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function validateName(value) {
  const v = sanitizeSpaces(value);
  if (!v) return "Le nom est obligatoire.";
  if (v.length < 2) return "Le nom est trop court.";
  if (v.length > 100) return "Le nom est trop long.";
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(v)) return "Le nom contient des caractères invalides.";
  return "";
}

function validateEmail(value) {
  const v = sanitizeSpaces(value).toLowerCase();
  if (!v) return "L'email est obligatoire.";
  if (v.length > 254) return "L'email est trop long.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Le format de l'email est invalide.";
  return "";
}

function validatePhone(value) {
  const v = sanitizeSpaces(value);
  if (!v) return "";
  if (v.length > 30) return "Le numéro est trop long.";
  if (!/^[0-9+()./\- ]+$/.test(v)) return "Le numéro de téléphone est invalide.";
  return "";
}

function validateSubject(value) {
  const v = sanitizeSpaces(value);
  if (!v) return "L'objet est obligatoire.";
  if (v.length < 3) return "L'objet est trop court.";
  if (v.length > 150) return "L'objet est trop long.";
  return "";
}

function validateMessage(value) {
  const v = String(value || "").trim();
  if (!v) return "Le message est obligatoire.";
  if (v.length < 10) return "Le message est trop court.";
  if (v.length > 5000) return "Le message est trop long.";
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
    if (event.requestContext?.http?.method === "OPTIONS") {
      return json(204, {});
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return badRequest("Corps JSON invalide.");
    }

    const payload = {
      name: sanitizeSpaces(body.name),
      email: sanitizeSpaces(body.email).toLowerCase(),
      phone: sanitizeSpaces(body.phone),
      subject: sanitizeSpaces(body.subject),
      message: String(body.message || "").trim(),
      website: String(body.website || "").trim(),
    };

    if (payload.website) {
      return ok({ success: true });
    }

    const errors = {
      name: validateName(payload.name),
      email: validateEmail(payload.email),
      phone: validatePhone(payload.phone),
      subject: validateSubject(payload.subject),
      message: validateMessage(payload.message),
    };

    if (Object.values(errors).some(Boolean)) {
      return badRequest("Validation échouée.", errors);
    }

    const now = new Date().toISOString();
    const messageId = `msg_${randomUUID()}`;
    const ipAddress = getClientIp(event);
    const geo = await resolveCountry(event, "iabag-contact/1.0");

    const item = {
      message_id: messageId,
      created_at: now,
      name: payload.name,
      email: payload.email,
      phone: payload.phone || "",
      subject: payload.subject,
      message: payload.message,
      status: "new",
      source: "contact_form",
      ip_address: ipAddress,
      country_code: geo.country_code || "",
      country_name: geo.country_name || "",
      geo_source: geo.geo_source || "",
      user_agent: getHeader(event?.headers, "user-agent") || "",
    };

    await db.send(
      new PutCommand({
        TableName: TABLE_CONTACT,
        Item: item,
      })
    );

    return ok({
      success: true,
      message_id: messageId,
      message: "Votre message a bien été enregistré.",
    });
  } catch (err) {
    console.error("contact_create error", err);
    return internalError();
  }
}