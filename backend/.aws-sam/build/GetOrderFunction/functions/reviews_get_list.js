/**
 * GET /products/{code}/reviews
 * Query params: limit (défaut 20), nextToken
 */

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, internalError } from "../shared/response.js";
import { encodeToken, decodeToken } from "../shared/pagination.js";

const TABLE = process.env.TABLE_AVIS;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function handler(event) {
  try {
    const code = decodeURIComponent(event.pathParameters?.code || "");
    const qs = event.queryStringParameters || {};
    const limit = Math.min(parseInt(qs.limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);
    const startKey = decodeToken(qs.nextToken);

    const result = await db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "code_produit = :cp",
        ExpressionAttributeValues: { ":cp": code },
        Limit: limit,
        ExclusiveStartKey: startKey,
        ScanIndexForward: false, // plus récents en premier
      })
    );

    return ok({
      items: result.Items || [],
      nextToken: encodeToken(result.LastEvaluatedKey),
    });
  } catch (err) {
    console.error("reviews_get_list error:", err);
    return internalError();
  }
}
