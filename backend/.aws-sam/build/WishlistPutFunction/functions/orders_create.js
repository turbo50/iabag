/**
 * POST /orders  (protected — Cognito JWT requis)
 *
 * Body JSON attendu :
 * {
 *   items: [
 *     { code_produit: string, quantite: number }
 *   ]
 * }
 *
 * Pour chaque ligne :
 *   - Vérifie que le produit existe dans iabag_produit
 *   - Récupère le prix_actuel
 *   - Calcule le montant_ligne et le total
 *
 * Génère un code_commande de la forme CMD-{timestamp}-{random4}.
 */

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import {
  created,
  badRequest,
  unauthorized,
  notFound,
  internalError,
} from "../shared/response.js";
import { requireSub } from "../shared/auth.js";

const TABLE_PRODUIT = process.env.TABLE_PRODUIT;
const TABLE_COMMANDE = process.env.TABLE_COMMANDE;

function generateOrderCode() {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CMD-${ts}-${rand}`;
}

export async function handler(event) {
  try {
    const codeClient = requireSub(event);

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return badRequest("Corps JSON invalide");
    }

    const rawItems = body.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return badRequest("items doit être un tableau non vide");
    }

    // Valider et enrichir chaque ligne
    const lignes = [];
    for (const ligne of rawItems) {
      const { code_produit, quantite } = ligne;

      if (!code_produit || typeof code_produit !== "string") {
        return badRequest("Chaque item doit avoir un code_produit (string)");
      }
      const qty = parseInt(quantite, 10);
      if (!Number.isInteger(qty) || qty < 1) {
        return badRequest(`quantite invalide pour ${code_produit}`);
      }

      // Vérifier existence du produit
      const prodResult = await db.send(
        new GetCommand({
          TableName: TABLE_PRODUIT,
          Key: { code_produit },
          ProjectionExpression: "code_produit, nom_produit, prix_actuel",
        })
      );

      if (!prodResult.Item) {
        return notFound(`Produit introuvable : ${code_produit}`);
      }

      const prix = Number(prodResult.Item.prix_actuel);
      lignes.push({
        code_produit,
        nom_produit: prodResult.Item.nom_produit || "",
        quantite: qty,
        prix_unitaire: prix,
        montant_ligne: Math.round(prix * qty * 100) / 100,
      });
    }

    const total = Math.round(lignes.reduce((s, l) => s + l.montant_ligne, 0) * 100) / 100;
    const dateCommande = new Date().toISOString();
    const codeCommande = generateOrderCode();

    const commande = {
      code_commande: codeCommande,
      code_client: codeClient,
      date_commande: dateCommande,
      lignes,
      total,
      statut: "en_attente",
    };

    await db.send(
      new PutCommand({
        TableName: TABLE_COMMANDE,
        Item: commande,
        ConditionExpression: "attribute_not_exists(code_commande)",
      })
    );

    return created(commande);
  } catch (err) {
    if (err.statusCode === 401) return unauthorized();
    console.error("orders_create error:", err);
    return internalError();
  }
}
