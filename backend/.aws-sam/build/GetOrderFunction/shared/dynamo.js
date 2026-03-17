/**
 * Wrapper DynamoDB DocumentClient (AWS SDK v3).
 * Exporte un singleton `db` prêt à l'emploi.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.REGION || process.env.AWS_REGION });

export const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});
