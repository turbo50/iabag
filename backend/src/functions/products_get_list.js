/**
 * GET /products
 * Query params: limit (défaut 20), nextToken, q (filtre texte côté app)
 *
 * Enrichit chaque produit avec :
 * - average_rating
 * - reviews_count
 * - notation / rating / note (aliases de compatibilité)
 */

import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../shared/dynamo.js";
import { ok, internalError } from "../shared/response.js";
import { encodeToken, decodeToken } from "../shared/pagination.js";

const TABLE_PRODUIT = process.env.TABLE_PRODUIT;
const TABLE_AVIS = process.env.TABLE_AVIS;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

async function getReviewSummaryForProduct(codeProduit) {
  if (!codeProduit) {
    return {
      average_rating: 0,
      reviews_count: 0,
    };
  }

  const result = await db.send(
    new QueryCommand({
      TableName: TABLE_AVIS,
      KeyConditionExpression: "code_produit = :cp",
      ExpressionAttributeValues: {
        ":cp": codeProduit,
      },
      ProjectionExpression: "rating, note",
      ScanIndexForward: false,
    })
  );

  const items = result.Items || [];
  if (!items.length) {
    return {
      average_rating: 0,
      reviews_count: 0,
    };
  }

  let total = 0;
  let count = 0;

  for (const item of items) {
    const raw = item?.rating ?? item?.note;
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0) {
      total += value;
      count += 1;
    }
  }

  const average = count > 0 ? Math.round((total / count) * 10) / 10 : 0;

  return {
    average_rating: average,
    reviews_count: count,
  };
}

async function enrichProductsWithReviewStats(products) {
  if (!Array.isArray(products) || products.length === 0) return [];

  const enriched = await Promise.all(
    products.map(async (product) => {
      const summary = await getReviewSummaryForProduct(product?.code_produit);

      return {
        ...product,
        average_rating: summary.average_rating,
        reviews_count: summary.reviews_count,

        // aliases de compatibilité pour le front existant
        notation: summary.average_rating,
        rating: summary.average_rating,
        note: summary.average_rating,
        avis_count: summary.reviews_count,
        reviews_count_label: summary.reviews_count,
      };
    })
  );

  return enriched;
}

export async function handler(event) {
  try {
    const qs = event.queryStringParameters || {};
    const limit = Math.min(parseInt(qs.limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);
    const startKey = decodeToken(qs.nextToken);
    const q = (qs.q || "").trim().toLowerCase();

    const result = await db.send(
      new ScanCommand({
        TableName: TABLE_PRODUIT,
        Limit: limit,
        ExclusiveStartKey: startKey,
      })
    );

    let items = result.Items || [];

    if (q) {
      items = items.filter((p) => {
        const searchable = [p.nom_produit, p.marque_produit, p.sku, p.code_produit]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      });
    }

    items = await enrichProductsWithReviewStats(items);

    return ok({
      items,
      nextToken: encodeToken(result.LastEvaluatedKey),
    });
  } catch (err) {
    console.error("products_get_list error:", err);
    return internalError();
  }
}