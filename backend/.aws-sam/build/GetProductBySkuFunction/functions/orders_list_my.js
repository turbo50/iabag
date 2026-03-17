/**
 * GET /clients/me/orders  (protected — Cognito JWT requis)
 * Query params: limit (défaut 20), nextToken
 *
 * Interroge le GSI client-date-index trié par date_commande DESC.
 */

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, unauthorized, internalError } from "../shared/response.js";
import { requireSub } from "../shared/auth.js";
import { encodeToken, decodeToken } from "../shared/pagination.js";

const TABLE = process.env.TABLE_COMMANDE;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function handler(event) {
  try {
    const codeClient = requireSub(event);
    const qs = event.queryStringParameters || {};
    const limit = Math.min(parseInt(qs.limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);
    const startKey = decodeToken(qs.nextToken);

    const result = await db.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: "client-date-index",
        KeyConditionExpression: "code_client = :cc",
        ExpressionAttributeValues: { ":cc": codeClient },
        Limit: limit,
        ExclusiveStartKey: startKey,
        ScanIndexForward: false, // plus récentes en premier
      })
    );

    return ok({
      items: result.Items || [],
      nextToken: encodeToken(result.LastEvaluatedKey),
    });
  } catch (err) {
    if (err.statusCode === 401) return unauthorized();
    console.error("orders_list_my error:", err);
    return internalError();
  }
}
