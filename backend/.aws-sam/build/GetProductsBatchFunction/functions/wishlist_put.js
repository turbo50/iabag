/**
 * POST /clients/me/wishlist  (protected — Cognito JWT requis)
 * Body JSON:
 *   { "code_produit": "P123" }
 *
 * Ajoute (idempotent) un produit dans la wishlist du client.
 * Table: iabag_wishlist
 * PK: code_client
 * SK: code_produit
 */

import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import { created, badRequest, unauthorized, internalError } from "../shared/response.js";
import { requireSub } from "../shared/auth.js";

const TABLE = process.env.TABLE_WISHLIST;

function parseJson(body) {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export async function handler(event) {
  try {
    const codeClient = requireSub(event);

    const payload = parseJson(event.body);
    const codeProduit = payload?.code_produit;

    if (!codeProduit || typeof codeProduit !== "string") {
      return badRequest("Missing or invalid code_produit");
    }

    const item = {
      code_client: codeClient,
      code_produit: codeProduit,
      created_at: new Date().toISOString(),
    };

    await db.send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
      })
    );

    return created({ item });
  } catch (err) {
    if (err.statusCode === 401) return unauthorized();
    console.error("wishlist_put error:", err);
    return internalError();
  }
}