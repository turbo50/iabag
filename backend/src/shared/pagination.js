/**
 * Helpers de pagination DynamoDB via base64url nextToken.
 *
 * DynamoDB retourne un objet ExclusiveStartKey (JSON) qu'on encode
 * en base64url pour l'exposer aux clients et le redécoder à la requête suivante.
 */

/**
 * Encode un ExclusiveStartKey DynamoDB en token opaque base64url.
 * @param {object|undefined} lastEvaluatedKey
 * @returns {string|undefined}
 */
export function encodeToken(lastEvaluatedKey) {
  if (!lastEvaluatedKey) return undefined;
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64url");
}

/**
 * Décode un token base64url en ExclusiveStartKey DynamoDB.
 * Retourne undefined si le token est absent ou invalide.
 * @param {string|undefined} token
 * @returns {object|undefined}
 */
export function decodeToken(token) {
  if (!token) return undefined;
  try {
    return JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}
