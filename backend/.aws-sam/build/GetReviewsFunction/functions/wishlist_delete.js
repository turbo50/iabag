/**
 * DELETE /clients/me/wishlist/{code}  (protected — Cognito JWT requis)
 *
 * Supprime un produit de la wishlist du client.
 * Path param: code (= code_produit)
 */

import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, badRequest, unauthorized, internalError } from "../shared/response.js";
import { requireSub } from "../shared/auth.js";

const TABLE = process.env.TABLE_WISHLIST;

export async function handler(event) {
  try {
    const codeClient = requireSub(event);

    const codeProduit = event?.pathParameters?.code;
    if (!codeProduit || typeof codeProduit !== "string") {
      return badRequest("Missing path parameter: code");
    }

    await db.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { code_client: codeClient, code_produit: codeProduit },
      })
    );

    // idempotent: même si l'item n'existe pas, on répond 200
    return ok({ deleted: true, code_produit: codeProduit });
  } catch (err) {
    if (err.statusCode === 401) return unauthorized();
    console.error("wishlist_delete error:", err);
    return internalError();
  }
}