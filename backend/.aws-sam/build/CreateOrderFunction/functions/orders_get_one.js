/**
 * GET /orders/{code}  (protected — Cognito JWT requis)
 *
 * Retourne la commande uniquement si elle appartient à l'utilisateur connecté
 * (compare code_client de la commande avec le sub JWT).
 */

import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, unauthorized, forbidden, notFound, internalError } from "../shared/response.js";
import { requireSub } from "../shared/auth.js";

const TABLE = process.env.TABLE_COMMANDE;

export async function handler(event) {
  try {
    const codeClient = requireSub(event);
    const codeCommande = decodeURIComponent(event.pathParameters?.code || "");
    if (!codeCommande) return notFound("code_commande manquant");

    const result = await db.send(
      new GetCommand({
        TableName: TABLE,
        Key: { code_commande: codeCommande },
      })
    );

    if (!result.Item) return notFound(`Commande introuvable : ${codeCommande}`);

    // Vérification d'appartenance
    if (result.Item.code_client !== codeClient) return forbidden();

    return ok(result.Item);
  } catch (err) {
    if (err.statusCode === 401) return unauthorized();
    console.error("orders_get_one error:", err);
    return internalError();
  }
}
