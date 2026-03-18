/**
 * GET /products/sku/{sku}
 * Interroge le GSI sku-index de la table iabag_produit.
 */

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, notFound, internalError } from "../shared/response.js";

const TABLE = process.env.TABLE_PRODUIT;

export async function handler(event) {
  try {
    const sku = decodeURIComponent(event.pathParameters?.sku || "");
    if (!sku) return notFound("sku manquant");

    const result = await db.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: "sku-index",
        KeyConditionExpression: "sku = :sku",
        ExpressionAttributeValues: { ":sku": sku },
        Limit: 1,
      })
    );

    const item = result.Items?.[0];
    if (!item) return notFound(`Produit introuvable pour SKU : ${sku}`);

    return ok(item);
  } catch (err) {
    console.error("products_get_by_sku error:", err);
    return internalError();
  }
}
