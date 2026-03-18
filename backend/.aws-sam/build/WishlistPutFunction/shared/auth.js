/**
 * Helpers d'authentification Cognito JWT.
 *
 * API Gateway HTTP API avec authorizer JWT injecte les claims dans :
 *   event.requestContext.authorizer.jwt.claims
 */

/**
 * Retourne les claims JWT ou null si absents.
 * @param {object} event  — event Lambda HTTP API Gateway
 * @returns {Record<string,string>|null}
 */
export function getJwtClaims(event) {
  return event?.requestContext?.authorizer?.jwt?.claims ?? null;
}

/**
 * Retourne le `sub` Cognito (code_client) ou lève une erreur 401.
 * @param {object} event
 * @returns {string}
 */
export function requireSub(event) {
  const claims = getJwtClaims(event);
  if (!claims?.sub) {
    const err = new Error("Missing or invalid JWT");
    err.statusCode = 401;
    throw err;
  }
  return claims.sub;
}
