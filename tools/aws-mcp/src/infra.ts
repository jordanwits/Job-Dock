/**
 * Infrastructure operations - CloudFormation, Lambda
 */

import {
  CloudFormationClient,
  DescribeStacksCommand,
  DescribeStackEventsCommand,
  DescribeStackResourcesCommand,
  ListStackResourcesCommand,
} from '@aws-sdk/client-cloudformation';
import {
  LambdaClient,
  GetFunctionCommand,
  GetFunctionConfigurationCommand,
  ListFunctionsCommand,
} from '@aws-sdk/client-lambda';
import type { InfraQueryParams, MCPToolResponse, MCPConfig } from './types.js';
import { getRegion, resolveFunctionName } from './config.js';

/**
 * Describe a CloudFormation stack
 */
export async function describeStack(
  params: InfraQueryParams,
  config: MCPConfig
): Promise<MCPToolResponse> {
  try {
    const stackName = params.stackNameAlias || config.stackName;
    const client = new CloudFormationClient({ region: getRegion() });

    const command = new DescribeStacksCommand({
      StackName: stackName,
    });

    const response = await client.send(command);
    
    if (!response.Stacks || response.Stacks.length === 0) {
      return {
        success: false,
        error: {
          code: 'NotFound',
          message: `Stack ${stackName} not found`,
        },
      };
    }

    const stack = response.Stacks[0];

    return {
      success: true,
      data: {
        stackName: stack.StackName,
        stackId: stack.StackId,
        status: stack.StackStatus,
        creationTime: stack.CreationTime,
        lastUpdatedTime: stack.LastUpdatedTime,
        description: stack.Description,
        outputs: stack.Outputs?.map(output => ({
          key: output.OutputKey,
          value: output.OutputValue,
          description: output.Description,
          exportName: output.ExportName,
        })) || [],
        parameters: stack.Parameters?.map(param => ({
          key: param.ParameterKey,
          value: param.ParameterValue,
        })) || [],
        tags: stack.Tags?.map(tag => ({
          key: tag.Key,
          value: tag.Value,
        })) || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'DescribeStackError',
        message: error.message || 'Failed to describe stack',
      },
    };
  }
}

/**
 * List stack resources
 */
export async function listStackResources(
  params: InfraQueryParams,
  config: MCPConfig
): Promise<MCPToolResponse> {
  try {
    const stackName = params.stackNameAlias || config.stackName;
    const client = new CloudFormationClient({ region: getRegion() });

    const command = new ListStackResourcesCommand({
      StackName: stackName,
    });

    const response = await client.send(command);
    
    const resources = response.StackResourceSummaries?.map(resource => ({
      logicalId: resource.LogicalResourceId,
      physicalId: resource.PhysicalResourceId,
      type: resource.ResourceType,
      status: resource.ResourceStatus,
      lastUpdated: resource.LastUpdatedTimestamp,
    })) || [];

    return {
      success: true,
      data: {
        stackName,
        count: resources.length,
        resources,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'ListResourcesError',
        message: error.message || 'Failed to list stack resources',
      },
    };
  }
}

/**
 * Get recent stack events (useful for debugging deployments)
 */
export async function getStackEvents(
  params: InfraQueryParams,
  config: MCPConfig,
  limit: number = 20
): Promise<MCPToolResponse> {
  try {
    const stackName = params.stackNameAlias || config.stackName;
    const client = new CloudFormationClient({ region: getRegion() });

    const command = new DescribeStackEventsCommand({
      StackName: stackName,
    });

    const response = await client.send(command);
    
    const events = (response.StackEvents || [])
      .slice(0, limit)
      .map(event => ({
        timestamp: event.Timestamp,
        logicalResourceId: event.LogicalResourceId,
        physicalResourceId: event.PhysicalResourceId,
        resourceType: event.ResourceType,
        status: event.ResourceStatus,
        statusReason: event.ResourceStatusReason,
      }));

    return {
      success: true,
      data: {
        stackName,
        count: events.length,
        events,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'GetEventsError',
        message: error.message || 'Failed to get stack events',
      },
    };
  }
}

/**
 * Describe a Lambda function
 */
export async function describeLambda(
  params: InfraQueryParams,
  config: MCPConfig
): Promise<MCPToolResponse> {
  try {
    if (!params.functionNameAlias) {
      return {
        success: false,
        error: {
          code: 'InvalidParams',
          message: 'functionNameAlias is required',
        },
      };
    }

    const functionName = resolveFunctionName(params.functionNameAlias, config);
    const client = new LambdaClient({ region: getRegion() });

    const command = new GetFunctionConfigurationCommand({
      FunctionName: functionName,
    });

    const response = await client.send(command);

    // Mask environment variables that look sensitive
    const environment = response.Environment?.Variables || {};
    const maskedEnv: Record<string, string> = {};
    const sensitivePatterns = [/password/i, /secret/i, /key/i, /token/i];
    
    for (const [key, value] of Object.entries(environment)) {
      if (sensitivePatterns.some(pattern => pattern.test(key))) {
        maskedEnv[key] = '***MASKED***';
      } else {
        maskedEnv[key] = value;
      }
    }

    return {
      success: true,
      data: {
        functionAlias: params.functionNameAlias,
        functionName: response.FunctionName,
        functionArn: response.FunctionArn,
        runtime: response.Runtime,
        handler: response.Handler,
        codeSize: response.CodeSize,
        description: response.Description,
        timeout: response.Timeout,
        memorySize: response.MemorySize,
        lastModified: response.LastModified,
        version: response.Version,
        role: response.Role,
        environment: maskedEnv,
        layers: response.Layers?.map(layer => ({
          arn: layer.Arn,
          codeSize: layer.CodeSize,
        })) || [],
        state: response.State,
        lastUpdateStatus: response.LastUpdateStatus,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'DescribeLambdaError',
        message: error.message || 'Failed to describe Lambda function',
      },
    };
  }
}

/**
 * List Lambda functions (with basic info)
 */
export async function listLambdaFunctions(
  config: MCPConfig,
  limit: number = 50
): Promise<MCPToolResponse> {
  try {
    const client = new LambdaClient({ region: getRegion() });

    const command = new ListFunctionsCommand({
      MaxItems: Math.min(limit, 50),
    });

    const response = await client.send(command);
    
    const functions = response.Functions?.map(func => ({
      functionName: func.FunctionName,
      functionArn: func.FunctionArn,
      runtime: func.Runtime,
      handler: func.Handler,
      codeSize: func.CodeSize,
      description: func.Description,
      timeout: func.Timeout,
      memorySize: func.MemorySize,
      lastModified: func.LastModified,
    })) || [];

    return {
      success: true,
      data: {
        count: functions.length,
        functions,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'ListFunctionsError',
        message: error.message || 'Failed to list Lambda functions',
      },
    };
  }
}

