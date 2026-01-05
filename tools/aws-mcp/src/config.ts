/**
 * Configuration loader and AWS credentials management
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { MCPConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load configuration from config.json
 */
export function loadConfig(): MCPConfig {
  const configPath = join(__dirname, '..', 'config.json');
  try {
    const configData = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData) as MCPConfig;
    
    // Override from environment if present
    if (process.env.AWS_REGION) {
      config.region = process.env.AWS_REGION;
    }
    if (process.env.JOBDOCK_STACK_NAME) {
      config.stackName = process.env.JOBDOCK_STACK_NAME;
    }
    
    return config;
  } catch (error) {
    console.error('Failed to load config.json:', error);
    throw new Error('Configuration file not found or invalid');
  }
}

/**
 * Get AWS region from config or environment
 */
export function getRegion(): string {
  return process.env.AWS_REGION || loadConfig().region;
}

/**
 * Validate resource name against config
 */
export function validateResourceAccess(resourceType: string, resourceName: string, config: MCPConfig): boolean {
  // For now, simple validation - can be extended
  return true;
}

/**
 * Resolve table alias to actual table name
 */
export function resolveTableName(alias: string, config: MCPConfig): string {
  const tableName = config.resources.dynamodb.aliases[alias];
  if (!tableName) {
    throw new Error(`Unknown table alias: ${alias}`);
  }
  return tableName;
}

/**
 * Resolve Lambda function alias to actual function name
 */
export function resolveFunctionName(alias: string, config: MCPConfig): string {
  const functionName = config.resources.lambda.aliases[alias];
  if (!functionName) {
    throw new Error(`Unknown function alias: ${alias}`);
  }
  return functionName;
}

/**
 * Resolve bucket alias to actual bucket name
 */
export function resolveBucketName(alias: string, config: MCPConfig): string {
  // For now, return as-is since we may use actual bucket names
  // Can be extended to use aliases from config
  if (config.resources.s3.buckets.length > 0 && !config.resources.s3.buckets.includes(alias)) {
    throw new Error(`Bucket ${alias} not in allowed list`);
  }
  return alias;
}

/**
 * Check if SSM parameter path is allowed
 */
export function isSSMPathAllowed(path: string, config: MCPConfig): boolean {
  return config.resources.ssm.allowedPrefixes.some(prefix => path.startsWith(prefix));
}

