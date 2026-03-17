# iabag — Backend AWS SAM

Backend serverless pour le site **iabag** : produits, avis, commandes.  
Stack : AWS SAM · API Gateway HTTP API · DynamoDB · Cognito JWT · Lambda Node.js 20 (arm64).

---

## Architecture

```
API Gateway HTTP API
  ├── GET  /products                    → getListProduct      (public)
  ├── GET  /products/{code}             → getProduct          (public)
  ├── GET  /products/sku/{sku}          → getProductBySku     (public)
  ├── GET  /products/{code}/reviews     → getReviews          (public)
  ├── POST /products/{code}/reviews     → putReview           (🔒 JWT)
  ├── POST /orders                      → createOrder         (🔒 JWT)
  ├── GET  /clients/me/orders           → listMyOrders        (🔒 JWT)
  └── GET  /orders/{code}               → getOrder            (🔒 JWT)

DynamoDB tables
  iabag_produit    PK code_produit          GSI sku-index (sku)
  iabag_client     PK code_client
  iabag_avis       PK code_produit  SK review_key (date_avis#code_client)
  iabag_commande   PK code_commande         GSI client-date-index (code_client, date_commande)
```

---

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Node.js | 20.x |
| AWS SAM CLI | 1.100+ |
| AWS CLI | 2.x (configuré avec les bonnes credentials) |

---

## Déploiement

### 1. Installer les dépendances

```bash
cd backend
npm install
```

### 2. Build SAM

```bash
sam build
```

### 3. Premier déploiement (interactif)

```bash
sam deploy --guided
```

Répondre aux questions :

| Question | Valeur |
|----------|--------|
| Stack Name | `iabag-backend` |
| AWS Region | `eu-west-3` |
| CognitoUserPoolId | votre User Pool ID (ex. `eu-west-3_XXXXXXXXX`) |
| CognitoUserPoolClientId | votre App Client ID |
| StageName | `prod` |
| Confirm changeset | `y` |
| Allow IAM role creation | `y` |
| Save arguments to samconfig.toml | `y` |

Les déploiements suivants utilisent simplement :

```bash
sam build && sam deploy
```

### 4. Récupérer l'URL de l'API

À la fin du déploiement, SAM affiche les **Outputs** :

```
Key                 ApiBaseUrl
Value               https://XXXXXXXXXX.execute-api.eu-west-3.amazonaws.com/prod
```

---

## Paramètres requis

| Paramètre SAM | Description |
|---------------|-------------|
| `CognitoUserPoolId` | ID du User Pool Cognito (ex. `eu-west-3_XXXXXXXXX`) |
| `CognitoUserPoolClientId` | ID du Client d'application Cognito |

Ces valeurs sont passées lors de `sam deploy --guided` et sauvegardées dans `samconfig.toml`.

---

## Configuration du frontend

Après déploiement, éditer **`assets/js/config.js`** :

```js
export const CONFIG = {
  // Passer à false pour utiliser l'API réelle
  USE_MOCK: false,

  // URL de base récupérée dans les Outputs SAM
  API_BASE_URL: "https://XXXXXXXXXX.execute-api.eu-west-3.amazonaws.com/prod",

  CURRENCY: "EUR",
  LOCALE: "fr-FR",
};
```

> **Ne pas changer `USE_MOCK` en production avant d'avoir déployé et testé le backend.**

---

## Structure du code

```
backend/
├── template.yaml              # SAM — API, Lambda, DynamoDB
├── package.json               # Dépendances (AWS SDK v3)
├── README.md
└── src/
    ├── shared/
    │   ├── auth.js            # Lecture des claims JWT Cognito
    │   ├── dynamo.js          # Singleton DynamoDBDocumentClient
    │   ├── pagination.js      # Encodage/décodage nextToken (base64url)
    │   └── response.js        # Helpers HTTP JSON + CORS
    └── functions/
        ├── products_get_list.js   # GET /products
        ├── products_get_one.js    # GET /products/{code}
        ├── products_get_by_sku.js # GET /products/sku/{sku}
        ├── reviews_get_list.js    # GET /products/{code}/reviews
        ├── reviews_put.js         # POST /products/{code}/reviews
        ├── orders_create.js       # POST /orders
        ├── orders_list_my.js      # GET /clients/me/orders
        └── orders_get_one.js      # GET /orders/{code}
```

---

## Endpoints — référence rapide

### Produits (publics)

#### `GET /products`
| Param query | Type | Défaut | Description |
|-------------|------|--------|-------------|
| `limit` | number | 20 | Nombre max de résultats (max 100) |
| `nextToken` | string | — | Token de pagination (opaque) |
| `q` | string | — | Filtre texte (nom, marque, SKU, code) |

Réponse :
```json
{ "items": [...], "nextToken": "..." }
```

#### `GET /products/{code}`
Retourne un produit par `code_produit`.

#### `GET /products/sku/{sku}`
Retourne un produit par `sku` (via GSI).

### Avis (publics en lecture, protégés en écriture)

#### `GET /products/{code}/reviews`
| Param query | Type | Défaut |
|-------------|------|--------|
| `limit` | number | 20 |
| `nextToken` | string | — |

#### `POST /products/{code}/reviews` 🔒
Header : `Authorization: Bearer <id_token>`  
Body :
```json
{ "note": 4, "commentaire": "Très bon produit !" }
```

### Commandes (protégées)

#### `POST /orders` 🔒
Body :
```json
{
  "items": [
    { "code_produit": "P001", "quantite": 2 },
    { "code_produit": "P003", "quantite": 1 }
  ]
}
```

#### `GET /clients/me/orders` 🔒
Retourne les commandes de l'utilisateur connecté.

#### `GET /orders/{code}` 🔒
Retourne une commande par `code_commande` (doit appartenir à l'utilisateur connecté).

---

## Variables d'environnement Lambda

Toutes les fonctions reçoivent automatiquement (via `template.yaml`) :

| Variable | Valeur |
|----------|--------|
| `TABLE_PRODUIT` | `iabag_produit` |
| `TABLE_CLIENT` | `iabag_client` |
| `TABLE_AVIS` | `iabag_avis` |
| `TABLE_COMMANDE` | `iabag_commande` |
| `REGION` | `${AWS::Region}` |
