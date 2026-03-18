/**
 * Helpers HTTP — réponses JSON avec en-têtes CORS.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
};

/**
 * Retourne une réponse HTTP API Gateway avec corps JSON et CORS.
 * @param {number} statusCode
 * @param {*} body  — objet sérialisé en JSON
 * @param {Record<string,string>} [extraHeaders]
 */
export function respond(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  };
}

export const ok = (body) => respond(200, body);
export const created = (body) => respond(201, body);
export const badRequest = (message) => respond(400, { error: message });
export const unauthorized = (message = "Unauthorized") => respond(401, { error: message });
export const forbidden = (message = "Forbidden") => respond(403, { error: message });
export const notFound = (message = "Not found") => respond(404, { error: message });
export const internalError = (message = "Internal server error") => respond(500, { error: message });
