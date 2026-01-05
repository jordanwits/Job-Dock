/**
 * CloudWatch Logs operations
 */

import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  DescribeLogStreamsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import type { LogQueryParams, MCPToolResponse, MCPConfig } from './types.js';
import { getRegion } from './config.js';

const MAX_RESULTS = 100;
const DEFAULT_TIME_RANGE_MS = 3600000; // 1 hour

/**
 * Get recent logs for a Lambda function
 */
export async function getLambdaLogs(
  params: LogQueryParams,
  config: MCPConfig
): Promise<MCPToolResponse> {
  try {
    if (!params.functionName && !params.logGroupName) {
      return {
        success: false,
        error: {
          code: 'InvalidParams',
          message: 'Either functionName or logGroupName must be provided',
        },
      };
    }

    const client = new CloudWatchLogsClient({ region: getRegion() });
    const logGroupName = params.logGroupName || `/aws/lambda/${params.functionName}`;
    
    const endTime = params.endTime || Date.now();
    const startTime = params.startTime || endTime - DEFAULT_TIME_RANGE_MS;
    
    const command = new FilterLogEventsCommand({
      logGroupName,
      startTime,
      endTime,
      limit: Math.min(params.limit || 50, MAX_RESULTS),
      filterPattern: params.filterPattern,
    });

    const response = await client.send(command);
    
    const logs = response.events?.map(event => ({
      timestamp: event.timestamp,
      message: event.message,
      logStreamName: event.logStreamName,
    })) || [];

    return {
      success: true,
      data: {
        logGroupName,
        startTime,
        endTime,
        count: logs.length,
        logs,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'LogsError',
        message: error.message || 'Failed to fetch logs',
      },
    };
  }
}

/**
 * Search logs with a filter pattern
 */
export async function searchLogs(
  params: LogQueryParams,
  config: MCPConfig
): Promise<MCPToolResponse> {
  try {
    if (!params.logGroupName) {
      return {
        success: false,
        error: {
          code: 'InvalidParams',
          message: 'logGroupName is required',
        },
      };
    }

    const client = new CloudWatchLogsClient({ region: getRegion() });
    
    const endTime = params.endTime || Date.now();
    const startTime = params.startTime || endTime - DEFAULT_TIME_RANGE_MS;
    
    const command = new FilterLogEventsCommand({
      logGroupName: params.logGroupName,
      startTime,
      endTime,
      limit: Math.min(params.limit || 50, MAX_RESULTS),
      filterPattern: params.filterPattern,
    });

    const response = await client.send(command);
    
    const logs = response.events?.map(event => ({
      timestamp: event.timestamp,
      message: event.message,
      logStreamName: event.logStreamName,
    })) || [];

    return {
      success: true,
      data: {
        logGroupName: params.logGroupName,
        filterPattern: params.filterPattern,
        startTime,
        endTime,
        count: logs.length,
        logs,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'SearchError',
        message: error.message || 'Failed to search logs',
      },
    };
  }
}

/**
 * List recent log streams for a log group
 */
export async function listLogStreams(
  logGroupName: string,
  limit: number = 20
): Promise<MCPToolResponse> {
  try {
    const client = new CloudWatchLogsClient({ region: getRegion() });
    
    const command = new DescribeLogStreamsCommand({
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit: Math.min(limit, 50),
    });

    const response = await client.send(command);
    
    const streams = response.logStreams?.map(stream => ({
      name: stream.logStreamName,
      lastEventTime: stream.lastEventTimestamp,
      lastIngestionTime: stream.lastIngestionTime,
    })) || [];

    return {
      success: true,
      data: {
        logGroupName,
        count: streams.length,
        streams,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'StreamError',
        message: error.message || 'Failed to list log streams',
      },
    };
  }
}

