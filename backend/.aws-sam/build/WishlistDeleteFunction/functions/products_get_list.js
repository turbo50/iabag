/**
 * GET /products
 * Query params: limit (défaut 20), nextToken, q (filtre texte côté app)
 */

import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, internalError } from "../shared/response.js";
import { encodeToken, decodeToken } from "../shared/pagination.js";

const TABLE = process.env.TABLE_PRODUIT;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function handler(event) {
  try {
    const qs = event.queryStringParameters || {};
    const limit = Math.min(parseInt(qs.limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);
    const startKey = decodeToken(qs.nextToken);
    const q = (qs.q || "").trim().toLowerCase();

    const result = await db.send(
      new ScanCommand({
        TableName: TABLE,
        Limit: limit,
        ExclusiveStartKey: startKey,
      })
    );

    let items = result.Items || [];

    // Filtrage optionnel (sur la page retournée)
    if (q) {
      items = items.filter((p) => {
        const searchable = [p.nom_produit, p.marque_produit, p.sku, p.code_produit]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      });
    }

    return ok({
      items,
      nextToken: encodeToken(result.LastEvaluatedKey),
    });
  } catch (err) {
    console.error("products_get_list error:", err);
    return internalError();
  }
}
