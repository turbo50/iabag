/**
 * GET /clients/me/wishlist  (protected — Cognito JWT requis)
 * Query params: limit (défaut 50), nextToken
 *
 * Retourne la wishlist (liste des code_produit) d'un client.
 * Table: iabag_wishlist
 * PK: code_client (sub cognito)
 * SK: code_produit
 */

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, unauthorized, internalError } from "../shared/response.js";
import { requireSub } from "../shared/auth.js";
import { encodeToken, decodeToken } from "../shared/pagination.js";

const TABLE = process.env.TABLE_WISHLIST;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function handler(event) {
  try {
    const codeClient = requireSub(event);

    const qs = event.queryStringParameters || {};
    const limit = Math.min(parseInt(qs.limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);
    const startKey = decodeToken(qs.nextToken);

    const result = await db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "code_client = :cc",
        ExpressionAttributeValues: { ":cc": codeClient },
        Limit: limit,
        ExclusiveStartKey: startKey,
        ScanIndexForward: true,
      })
    );

    return ok({
      items: result.Items || [],
      nextToken: encodeToken(result.LastEvaluatedKey),
    });
  } catch (err) {
    if (err.statusCode === 401) return unauthorized();
    console.error("wishlist_get_list error:", err);
    return internalError();
  }
}