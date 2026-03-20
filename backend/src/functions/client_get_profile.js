import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, badRequest, internalError } from "../shared/response.js";

const TABLE = process.env.TABLE_CLIENT;

export async function handler(event) {
  try {
    const auth = event.requestContext?.authorizer?.jwt;
    const sub = auth?.claims?.sub;
    if (!sub) return badRequest("Non autorisé (pas de sub Cognito)");

    const result = await db.send(
      new GetItemCommand({
        TableName: TABLE,
        Key: {
          code_client: { S: sub },
        },
      })
    );

    const item = result?.Item || null;

    return ok({
      code_client: sub,
      pseudo: item?.pseudo?.S || "",
    });
  } catch (err) {
    console.error("GetClientProfile error", err);
    return internalError();
  }
}