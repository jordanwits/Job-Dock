/**
 * DynamoDB operations
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type { DynamoDBQueryParams, MCPToolResponse, MCPConfig } from './types.js';
import { getRegion, resolveTableName } from './config.js';

const MAX_ITEMS = 100;

/**
 * Get a single item by primary key
 */
export async function getItem(
  params: DynamoDBQueryParams,
  config: MCPConfig
): Promise<MCPToolResponse> {
  try {
    if (!params.key) {
      return {
        success: false,
        error: {
          code: 'InvalidParams',
          message: 'key is required',
        },
      };
    }

    const tableName = resolveTableName(params.tableAlias, config);
    const client = new DynamoDBClient({ region: getRegion() });
    const docClient = DynamoDBDocumentClient.from(client);

    const command = new GetCommand({
      TableName: tableName,
      Key: params.key,
    });

    const response = await docClient.send(command);

    return {
      success: true,
      data: {
        tableAlias: params.tableAlias,
        tableName,
        item: response.Item || null,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'GetItemError',
        message: error.message || 'Failed to get item',
      },
    };
  }
}

/**
 * Query items with partition key and optional sort key condition
 */
export async function queryItems(
  params: DynamoDBQueryParams,
  config: MCPConfig
): Promise<MCPToolResponse> {
  try {
    if (!params.keyCondition) {
      return {
        success: false,
        error: {
          code: 'InvalidParams',
          message: 'keyCondition is required (e.g., "tenantId = :tenantId")',
        },
      };
    }

    const tableName = resolveTableName(params.tableAlias, config);
    const client = new DynamoDBClient({ region: getRegion() });
    const docClient = DynamoDBDocumentClient.from(client);

    // Parse simple key conditions (this is basic - could be enhanced)
    const expressionAttributeValues: Record<string, any> = {};
    const keyConditionParts = params.keyCondition.split('=');
    if (keyConditionParts.length === 2) {
      const placeholder = keyConditionParts[1].trim();
      if (params.key && placeholder.startsWith(':')) {
        const keyName = placeholder.substring(1);
        expressionAttributeValues[placeholder] = params.key[keyName];
      }
    }

    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: params.keyCondition,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: Math.min(params.limit || 20, MAX_ITEMS),
    });

    const response = await docClient.send(command);

    return {
      success: true,
      data: {
        tableAlias: params.tableAlias,
        tableName,
        count: response.Items?.length || 0,
        items: response.Items || [],
        lastEvaluatedKey: response.LastEvaluatedKey,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'QueryError',
        message: error.message || 'Failed to query items',
      },
    };
  }
}

/**
 * Scan table with limit (for sampling/debugging)
 */
export async function scanSample(
  params: DynamoDBQueryParams,
  config: MCPConfig
): Promise<MCPToolResponse> {
  try {
    const tableName = resolveTableName(params.tableAlias, config);
    const client = new DynamoDBClient({ region: getRegion() });
    const docClient = DynamoDBDocumentClient.from(client);

    const command = new ScanCommand({
      TableName: tableName,
      Limit: Math.min(params.limit || 10, 50), // Keep scans small
    });

    const response = await docClient.send(command);

    return {
      success: true,
      data: {
        tableAlias: params.tableAlias,
        tableName,
        count: response.Items?.length || 0,
        items: response.Items || [],
        note: 'This is a sample scan with limited results',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'ScanError',
        message: error.message || 'Failed to scan table',
      },
    };
  }
}

