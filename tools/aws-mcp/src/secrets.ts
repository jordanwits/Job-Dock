/**
 * SSM Parameter Store and Secrets Manager operations
 */

import {
  SSMClient,
  GetParameterCommand,
  GetParametersByPathCommand,
  DescribeParametersCommand,
} from '@aws-sdk/client-ssm';
import {
  SecretsManagerClient,
  ListSecretsCommand,
  DescribeSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import type { SSMQueryParams, MCPToolResponse, MCPConfig } from './types.js';
import { getRegion, isSSMPathAllowed } from './config.js';

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /key/i,
  /token/i,
  /credential/i,
  /auth/i,
];

/**
 * Check if a parameter name looks sensitive
 */
function isSensitive(name: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * Mask sensitive values
 */
function maskValue(value: string, name: string): string {
  if (isSensitive(name)) {
    return '***MASKED***';
  }
  return value;
}

/**
 * List parameters by path prefix
 */
export async function listParameters(
  params: SSMQueryParams,
  config: MCPConfig
): Promise<MCPToolResponse> {
  try {
    const pathPrefix = params.pathPrefix || '/jobdock/';
    
    if (!isSSMPathAllowed(pathPrefix, config)) {
      return {
        success: false,
        error: {
          code: 'AccessDenied',
          message: `Path ${pathPrefix} is not in the allowed list`,
        },
      };
    }

    const client = new SSMClient({ region: getRegion() });
    
    const command = new GetParametersByPathCommand({
      Path: pathPrefix,
      Recursive: true,
      MaxResults: 50,
    });

    const response = await client.send(command);
    
    const parameters = response.Parameters?.map(param => ({
      name: param.Name,
      type: param.Type,
      lastModified: param.LastModifiedDate,
      version: param.Version,
      dataType: param.DataType,
    })) || [];

    return {
      success: true,
      data: {
        pathPrefix,
        count: parameters.length,
        parameters,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'ListParametersError',
        message: error.message || 'Failed to list parameters',
      },
    };
  }
}

/**
 * Get a specific parameter value (with masking for sensitive values)
 */
export async function getParameterValue(
  params: SSMQueryParams,
  config: MCPConfig
): Promise<MCPToolResponse> {
  try {
    if (!params.name) {
      return {
        success: false,
        error: {
          code: 'InvalidParams',
          message: 'name is required',
        },
      };
    }

    // Check if path is allowed
    const pathAllowed = config.resources.ssm.allowedPrefixes.some(prefix =>
      params.name!.startsWith(prefix)
    );
    
    if (!pathAllowed) {
      return {
        success: false,
        error: {
          code: 'AccessDenied',
          message: `Parameter ${params.name} is not in an allowed path`,
        },
      };
    }

    const client = new SSMClient({ region: getRegion() });
    
    const command = new GetParameterCommand({
      Name: params.name,
      WithDecryption: true,
    });

    const response = await client.send(command);
    
    if (!response.Parameter) {
      return {
        success: false,
        error: {
          code: 'NotFound',
          message: `Parameter ${params.name} not found`,
        },
      };
    }

    const param = response.Parameter;
    const value = param.Value || '';
    const maskedValue = maskValue(value, params.name);
    const wasMasked = maskedValue !== value;

    return {
      success: true,
      data: {
        name: param.Name,
        type: param.Type,
        value: maskedValue,
        version: param.Version,
        lastModified: param.LastModifiedDate,
        dataType: param.DataType,
        wasMasked,
        note: wasMasked ? 'Value was masked for security' : undefined,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'GetParameterError',
        message: error.message || 'Failed to get parameter',
      },
    };
  }
}

/**
 * List secrets from Secrets Manager (names and metadata only)
 */
export async function listSecrets(
  config: MCPConfig
): Promise<MCPToolResponse> {
  try {
    const client = new SecretsManagerClient({ region: getRegion() });
    
    const command = new ListSecretsCommand({
      MaxResults: 50,
    });

    const response = await client.send(command);
    
    const secrets = response.SecretList?.map(secret => ({
      name: secret.Name,
      arn: secret.ARN,
      description: secret.Description,
      lastChanged: secret.LastChangedDate,
      lastAccessed: secret.LastAccessedDate,
    })) || [];

    return {
      success: true,
      data: {
        count: secrets.length,
        secrets,
        note: 'Secret values are not returned for security reasons',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'ListSecretsError',
        message: error.message || 'Failed to list secrets',
      },
    };
  }
}

/**
 * Describe a secret (metadata only, no values)
 */
export async function describeSecret(
  secretName: string,
  config: MCPConfig
): Promise<MCPToolResponse> {
  try {
    const client = new SecretsManagerClient({ region: getRegion() });
    
    const command = new DescribeSecretCommand({
      SecretId: secretName,
    });

    const response = await client.send(command);

    return {
      success: true,
      data: {
        name: response.Name,
        arn: response.ARN,
        description: response.Description,
        lastChanged: response.LastChangedDate,
        lastAccessed: response.LastAccessedDate,
        rotationEnabled: response.RotationEnabled,
        rotationLambdaARN: response.RotationLambdaARN,
        versionIdsToStages: response.VersionIdsToStages,
        note: 'Secret value is not returned for security reasons',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'DescribeSecretError',
        message: error.message || 'Failed to describe secret',
      },
    };
  }
}

