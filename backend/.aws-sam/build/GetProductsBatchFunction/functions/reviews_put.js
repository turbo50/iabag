/**
 * POST /products/{code}/reviews  (protected — Cognito JWT requis)
 *
 * Body JSON attendu :
 *   { note: number (1-5), commentaire?: string }
 *
 * La clé composite review_key est construite comme : {date_avis}#{code_client}
 */

import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, badRequest, unauthorized, internalError } from "../shared/response.js";
import { requireSub } from "../shared/auth.js";

const TABLE = process.env.TABLE_AVIS;

export async function handler(event) {
  try {
    const codeClient = requireSub(event);
    const codeProduit = decodeURIComponent(event.pathParameters?.code || "");
    if (!codeProduit) return badRequest("code_produit manquant");

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return badRequest("Corps JSON invalide");
    }

    const note = Number(body.note);
    if (!Number.isInteger(note) || note < 1 || note > 5) {
      return badRequest("note doit être un entier entre 1 et 5");
    }

    const dateAvis = new Date().toISOString();
    const reviewKey = `${dateAvis}#${codeClient}`;

    const item = {
      code_produit: codeProduit,
      review_key: reviewKey,
      code_client: codeClient,
      date_avis: dateAvis,
      note,
      commentaire: body.commentaire || "",
    };

    await db.send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
      })
    );

    return ok(item);
  } catch (err) {
    if (err.statusCode === 401) return unauthorized();
    console.error("reviews_put error:", err);
    return internalError();
  }
}
