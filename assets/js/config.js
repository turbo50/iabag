export const CONFIG = {
  // true = lit data/products.json (mock)
  // false = appelle l'API qui lit DynamoDB
  USE_MOCK: false,

  // Mock
  MOCK_PRODUCTS_URL: "data/product.json",

  // API (API Gateway) - à remplacer par ton endpoint
  // Exemple: "https://abc123.execute-api.eu-west-3.amazonaws.com/prod"
  API_BASE_URL: "https://fg8v8uf12c.execute-api.eu-west-3.amazonaws.com/dev",

  // Devise / format
  CURRENCY: "EUR",
  LOCALE: "fr-FR",
};