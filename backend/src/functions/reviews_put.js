/**
 * POST /products/{code}/reviews  (protected — Cognito JWT requis)
 *
 * Body JSON attendu :
 *   {
 *     rating: number (1-5),
 *     titre?: string,
 *     commentaire?: string,
 *     email?: string
 *   }
 *
 * La clé composite review_key est construite comme : {date_avis}#{code_client}
 * => plusieurs avis possibles pour le même client / même produit.
 */

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, badRequest, unauthorized, internalError } from "../shared/response.js";
import { requireSub } from "../shared/auth.js";

const TABLE_AVIS = process.env.TABLE_AVIS;
const TABLE_CLIENT = process.env.TABLE_CLIENT;

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

    const rating = Number(body.rating ?? body.note);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return badRequest("rating doit être un entier entre 1 et 5");
    }

    const titre = String(body.titre ?? body.review ?? "").trim();
    const commentaire = String(body.commentaire ?? body.message ?? "").trim();
    const email = String(body.email ?? "").trim();

    if (!commentaire) {
      return badRequest("commentaire manquant");
    }

    const clientResult = await db.send(
      new GetCommand({
        TableName: TABLE_CLIENT,
        Key: {
          code_client: codeClient,
        },
      })
    );

    const pseudo = String(clientResult?.Item?.pseudo || "").trim();
    if (!pseudo) {
      return badRequest("Pseudo client introuvable. Complète d’abord ton profil.");
    }

    const dateAvis = new Date().toISOString();
    const reviewKey = `${dateAvis}#${codeClient}`;

    const item = {
      code_produit: codeProduit,
      review_key: reviewKey,
      code_client: codeClient,
      pseudo,
      date_avis: dateAvis,
      rating,
      note: rating,
      titre,
      commentaire,
      email,
    };

    await db.send(
      new PutCommand({
        TableName: TABLE_AVIS,
        Item: item,
      })
    );

    return ok(item);
  } catch (err) {
    if (err?.statusCode === 401) return unauthorized();
    console.error("reviews_put error:", err);
    return internalError();
  }
}