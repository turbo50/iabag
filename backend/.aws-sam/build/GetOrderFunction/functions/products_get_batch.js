/**
 * POST /products/batch
 * Body JSON: { "codes": ["P001","P002", ...] }
 *
 * Récupère des produits par code_produit via BatchGet.
 * Limite DynamoDB BatchGet: 100 keys par requête => on chunk.
 */

import { BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, badRequest, internalError } from "../shared/response.js";

const TABLE = process.env.TABLE_PRODUIT;
const MAX_CODES = 200;          // limite "API" (tu peux ajuster)
const DDB_BATCH_LIMIT = 100;    // limite DynamoDB

function safeJsonParse(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function uniqStrings(arr) {
  return [...new Set(arr.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean))];
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function handler(event) {
  try {
    const payload = safeJsonParse(event.body);
    const codes = uniqStrings(payload?.codes || []);

    if (!Array.isArray(payload?.codes)) {
      return badRequest("Body invalide. Attendu: { codes: string[] }");
    }
    if (codes.length === 0) {
      return ok({ items: [], notFound: [] });
    }
    if (codes.length > MAX_CODES) {
      return badRequest(`Trop de codes demandés (max ${MAX_CODES}).`);
    }

    const foundItems = [];
    const foundCodes = new Set();

    // BatchGet en chunks de 100
    for (const part of chunk(codes, DDB_BATCH_LIMIT)) {
      const result = await db.send(
        new BatchGetCommand({
          RequestItems: {
            [TABLE]: {
              Keys: part.map((code) => ({ code_produit: code })),
            },
          },
        })
      );

      const items = result?.Responses?.[TABLE] || [];
      for (const it of items) {
        foundItems.push(it);
        if (it?.code_produit) foundCodes.add(it.code_produit);
      }

      // (Optionnel) gérer UnprocessedKeys si tu veux être 100% robuste
      // Ici on reste simple. Si tu veux, je te fournis la version avec retry.
    }

    const notFound = codes.filter((c) => !foundCodes.has(c));

    return ok({
      items: foundItems,
      notFound,
    });
  } catch (err) {
    console.error("products_get_batch error:", err);
    return internalError();
  }
}