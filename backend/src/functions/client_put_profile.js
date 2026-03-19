import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, badRequest, internalError } from "../shared/response.js";

const TABLE = process.env.TABLE_CLIENT;

export async function handler(event) {
  try {
    const auth = event.requestContext?.authorizer?.jwt;
    const sub = auth?.claims?.sub;
    if (!sub) return badRequest("Non autorisé (pas de sub Cognito)");

    const payload = JSON.parse(event.body || "{}");
    const pseudo = (payload.pseudo || "").trim();
    if (!pseudo) return badRequest("Pseudo manquant");

    await db.send(new PutItemCommand({
      TableName: TABLE,
      Item: {
        code_client: { S: sub },
        pseudo: { S: pseudo }
      }
    }));

    return ok({ code_client: sub, pseudo });
  } catch (err) {
    console.error("PutClientProfile error", err);
    return internalError();
  }
}