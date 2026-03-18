/**
 * GET /products/{code}
 */

import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, notFound, internalError } from "../shared/response.js";

const TABLE = process.env.TABLE_PRODUIT;

export async function handler(event) {
  try {
    const code = decodeURIComponent(event.pathParameters?.code || "");
    if (!code) return notFound("code_produit manquant");

    const result = await db.send(
      new GetCommand({
        TableName: TABLE,
        Key: { code_produit: code },
      })
    );

    if (!result.Item) return notFound(`Produit introuvable : ${code}`);

    return ok(result.Item);
  } catch (err) {
    console.error("products_get_one error:", err);
    return internalError();
  }
}
