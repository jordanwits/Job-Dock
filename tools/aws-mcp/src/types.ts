/**
 * Configuration types for the JobDock AWS MCP server
 */

export interface MCPConfig {
  region: string;
  stackName: string;
  resources: {
    dynamodb: {
      aliases: Record<string, string>;
    };
    s3: {
      buckets: string[];
    };
    lambda: {
      aliases: Record<string, string>;
    };
    ssm: {
      allowedPrefixes: string[];
    };
  };
}

export interface LogQueryParams {
  functionName?: string;
  logGroupName?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  filterPattern?: string;
}

export interface DynamoDBQueryParams {
  tableAlias: string;
  key?: Record<string, any>;
  keyCondition?: string;
  limit?: number;
}

export interface S3QueryParams {
  bucketAlias: string;
  prefix?: string;
  key?: string;
  limit?: number;
  maxBytes?: number;
}

export interface SSMQueryParams {
  pathPrefix?: string;
  name?: string;
}

export interface InfraQueryParams {
  stackNameAlias?: string;
  functionNameAlias?: string;
}

export interface MCPToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

