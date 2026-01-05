#!/usr/bin/env node

/**
 * JobDock AWS MCP Server
 * Provides AI-accessible AWS operations for debugging and inspecting JobDock infrastructure
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig } from './config.js';
import { getLambdaLogs, searchLogs, listLogStreams } from './logs.js';
import { getItem, queryItems, scanSample } from './db.js';
import { listObjects, getObjectText, getObjectMetadata } from './storage.js';
import { listParameters, getParameterValue, listSecrets, describeSecret } from './secrets.js';
import {
  describeStack,
  listStackResources,
  getStackEvents,
  describeLambda,
  listLambdaFunctions,
} from './infra.js';

// Load configuration
const config = loadConfig();

// Define MCP tools
const tools: Tool[] = [
  // Logs & Monitoring
  {
    name: 'aws_get_lambda_logs',
    description: 'Fetch recent CloudWatch logs for a JobDock Lambda function. Useful for debugging function execution and errors.',
    inputSchema: {
      type: 'object',
      properties: {
        functionName: {
          type: 'string',
          description: 'Lambda function name or alias (e.g., "auth", "data")',
        },
        logGroupName: {
          type: 'string',
          description: 'Explicit log group name (alternative to functionName)',
        },
        startTime: {
          type: 'number',
          description: 'Start time in milliseconds since epoch (optional)',
        },
        endTime: {
          type: 'number',
          description: 'End time in milliseconds since epoch (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of log events to return (default: 50, max: 100)',
        },
        filterPattern: {
          type: 'string',
          description: 'CloudWatch Logs filter pattern (optional)',
        },
      },
    },
  },
  {
    name: 'aws_search_logs',
    description: 'Search CloudWatch logs with a filter pattern across a log group.',
    inputSchema: {
      type: 'object',
      properties: {
        logGroupName: {
          type: 'string',
          description: 'CloudWatch log group name',
        },
        filterPattern: {
          type: 'string',
          description: 'CloudWatch Logs filter pattern',
        },
        startTime: {
          type: 'number',
          description: 'Start time in milliseconds since epoch (optional)',
        },
        endTime: {
          type: 'number',
          description: 'End time in milliseconds since epoch (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of log events (default: 50)',
        },
      },
      required: ['logGroupName'],
    },
  },
  
  // Database Operations
  {
    name: 'aws_dynamodb_get_item',
    description: 'Get a single item from a JobDock DynamoDB table by primary key.',
    inputSchema: {
      type: 'object',
      properties: {
        tableAlias: {
          type: 'string',
          description: 'Table alias (e.g., "jobs", "customers", "invoices", "quotes")',
        },
        key: {
          type: 'object',
          description: 'Primary key object (e.g., {"tenantId": "tenant-123", "id": "job-456"})',
        },
      },
      required: ['tableAlias', 'key'],
    },
  },
  {
    name: 'aws_dynamodb_query',
    description: 'Query items from a JobDock DynamoDB table using partition key.',
    inputSchema: {
      type: 'object',
      properties: {
        tableAlias: {
          type: 'string',
          description: 'Table alias (e.g., "jobs", "customers")',
        },
        keyCondition: {
          type: 'string',
          description: 'Key condition expression (e.g., "tenantId = :tenantId")',
        },
        key: {
          type: 'object',
          description: 'Key values for the expression (e.g., {"tenantId": "tenant-123"})',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of items to return (default: 20, max: 100)',
        },
      },
      required: ['tableAlias', 'keyCondition'],
    },
  },
  {
    name: 'aws_dynamodb_scan',
    description: 'Scan a JobDock DynamoDB table to sample records (use sparingly for debugging).',
    inputSchema: {
      type: 'object',
      properties: {
        tableAlias: {
          type: 'string',
          description: 'Table alias (e.g., "jobs", "customers")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of items (default: 10, max: 50)',
        },
      },
      required: ['tableAlias'],
    },
  },

  // S3 Storage
  {
    name: 'aws_s3_list_objects',
    description: 'List objects in a JobDock S3 bucket with optional prefix filter.',
    inputSchema: {
      type: 'object',
      properties: {
        bucketAlias: {
          type: 'string',
          description: 'Bucket name or alias',
        },
        prefix: {
          type: 'string',
          description: 'Object key prefix to filter by (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of objects (default: 50, max: 100)',
        },
      },
      required: ['bucketAlias'],
    },
  },
  {
    name: 'aws_s3_get_object',
    description: 'Get text content from an S3 object (for logs, configs, small files).',
    inputSchema: {
      type: 'object',
      properties: {
        bucketAlias: {
          type: 'string',
          description: 'Bucket name or alias',
        },
        key: {
          type: 'string',
          description: 'Object key',
        },
        maxBytes: {
          type: 'number',
          description: 'Maximum bytes to read (default: 1MB)',
        },
      },
      required: ['bucketAlias', 'key'],
    },
  },

  // Configuration & Secrets
  {
    name: 'aws_ssm_list_parameters',
    description: 'List SSM parameters under a path prefix (e.g., /jobdock/).',
    inputSchema: {
      type: 'object',
      properties: {
        pathPrefix: {
          type: 'string',
          description: 'Parameter path prefix (default: /jobdock/)',
        },
      },
    },
  },
  {
    name: 'aws_ssm_get_parameter',
    description: 'Get a specific SSM parameter value (sensitive values are masked).',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Parameter name',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'aws_secrets_list',
    description: 'List Secrets Manager secrets (metadata only, no values returned).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // Infrastructure
  {
    name: 'aws_describe_stack',
    description: 'Describe a JobDock CloudFormation stack with status, outputs, and parameters.',
    inputSchema: {
      type: 'object',
      properties: {
        stackNameAlias: {
          type: 'string',
          description: 'Stack name or alias (optional, defaults to main JobDock stack)',
        },
      },
    },
  },
  {
    name: 'aws_list_stack_resources',
    description: 'List all resources in a JobDock CloudFormation stack.',
    inputSchema: {
      type: 'object',
      properties: {
        stackNameAlias: {
          type: 'string',
          description: 'Stack name or alias (optional)',
        },
      },
    },
  },
  {
    name: 'aws_get_stack_events',
    description: 'Get recent CloudFormation stack events (useful for debugging failed deployments).',
    inputSchema: {
      type: 'object',
      properties: {
        stackNameAlias: {
          type: 'string',
          description: 'Stack name or alias (optional)',
        },
        limit: {
          type: 'number',
          description: 'Number of events to return (default: 20)',
        },
      },
    },
  },
  {
    name: 'aws_describe_lambda',
    description: 'Describe a JobDock Lambda function configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        functionNameAlias: {
          type: 'string',
          description: 'Function alias (e.g., "auth", "data")',
        },
      },
      required: ['functionNameAlias'],
    },
  },
  {
    name: 'aws_list_lambdas',
    description: 'List Lambda functions in the JobDock account.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of functions (default: 50)',
        },
      },
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'jobdock-aws-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Logs
      case 'aws_get_lambda_logs':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await getLambdaLogs(args as any, config), null, 2),
            },
          ],
        };
      case 'aws_search_logs':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await searchLogs(args as any, config), null, 2),
            },
          ],
        };

      // DynamoDB
      case 'aws_dynamodb_get_item':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await getItem(args as any, config), null, 2),
            },
          ],
        };
      case 'aws_dynamodb_query':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await queryItems(args as any, config), null, 2),
            },
          ],
        };
      case 'aws_dynamodb_scan':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await scanSample(args as any, config), null, 2),
            },
          ],
        };

      // S3
      case 'aws_s3_list_objects':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await listObjects(args as any, config), null, 2),
            },
          ],
        };
      case 'aws_s3_get_object':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await getObjectText(args as any, config), null, 2),
            },
          ],
        };

      // SSM & Secrets
      case 'aws_ssm_list_parameters':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await listParameters(args as any, config), null, 2),
            },
          ],
        };
      case 'aws_ssm_get_parameter':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await getParameterValue(args as any, config), null, 2),
            },
          ],
        };
      case 'aws_secrets_list':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await listSecrets(config), null, 2),
            },
          ],
        };

      // Infrastructure
      case 'aws_describe_stack':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await describeStack(args as any, config), null, 2),
            },
          ],
        };
      case 'aws_list_stack_resources':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await listStackResources(args as any, config), null, 2),
            },
          ],
        };
      case 'aws_get_stack_events':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await getStackEvents(args as any, config, (args as any)?.limit),
                null,
                2
              ),
            },
          ],
        };
      case 'aws_describe_lambda':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await describeLambda(args as any, config), null, 2),
            },
          ],
        };
      case 'aws_list_lambdas':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await listLambdaFunctions(config, (args as any)?.limit),
                null,
                2
              ),
            },
          ],
        };

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'UnknownTool',
                  message: `Unknown tool: ${name}`,
                },
              }),
            },
          ],
        };
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'ServerError',
              message: error.message || 'Internal server error',
            },
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  console.error('Starting JobDock AWS MCP Server...');
  console.error(`Region: ${config.region}`);
  console.error(`Stack: ${config.stackName}`);
  console.error(`AWS Profile: ${process.env.AWS_PROFILE || 'default'}`);
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('JobDock AWS MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

