/**
 * S3 storage operations
 */

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import type { S3QueryParams, MCPToolResponse, MCPConfig } from './types.js';
import { getRegion, resolveBucketName } from './config.js';

const MAX_KEYS = 100;
const MAX_OBJECT_SIZE = 1024 * 1024; // 1MB

/**
 * List objects in a bucket with optional prefix
 */
export async function listObjects(
  params: S3QueryParams,
  config: MCPConfig
): Promise<MCPToolResponse> {
  try {
    const bucketName = resolveBucketName(params.bucketAlias, config);
    const client = new S3Client({ region: getRegion() });

    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: params.prefix || '',
      MaxKeys: Math.min(params.limit || 50, MAX_KEYS),
    });

    const response = await client.send(command);

    const objects = response.Contents?.map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified,
      storageClass: obj.StorageClass,
    })) || [];

    return {
      success: true,
      data: {
        bucketAlias: params.bucketAlias,
        bucketName,
        prefix: params.prefix || '',
        count: objects.length,
        objects,
        isTruncated: response.IsTruncated,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'ListObjectsError',
        message: error.message || 'Failed to list objects',
      },
    };
  }
}

/**
 * Get text content from an S3 object
 */
export async function getObjectText(
  params: S3QueryParams,
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

    const bucketName = resolveBucketName(params.bucketAlias, config);
    const client = new S3Client({ region: getRegion() });

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: params.key,
      Range: params.maxBytes ? `bytes=0-${params.maxBytes}` : undefined,
    });

    const response = await client.send(command);
    
    if (!response.Body) {
      return {
        success: false,
        error: {
          code: 'EmptyObject',
          message: 'Object has no content',
        },
      };
    }

    // Read stream to string
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    const maxBytes = params.maxBytes || MAX_OBJECT_SIZE;

    for await (const chunk of response.Body as any) {
      totalSize += chunk.length;
      if (totalSize > maxBytes) {
        chunks.push(chunk.slice(0, maxBytes - (totalSize - chunk.length)));
        break;
      }
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    const content = buffer.toString('utf-8');
    const wasTruncated = totalSize > maxBytes;

    return {
      success: true,
      data: {
        bucketAlias: params.bucketAlias,
        bucketName,
        key: params.key,
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        content,
        wasTruncated,
        note: wasTruncated ? `Content truncated at ${maxBytes} bytes` : undefined,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'GetObjectError',
        message: error.message || 'Failed to get object',
      },
    };
  }
}

/**
 * Get object metadata without fetching content
 */
export async function getObjectMetadata(
  params: S3QueryParams,
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

    const bucketName = resolveBucketName(params.bucketAlias, config);
    const client = new S3Client({ region: getRegion() });

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: params.key,
    });

    const response = await client.send(command);

    return {
      success: true,
      data: {
        bucketAlias: params.bucketAlias,
        bucketName,
        key: params.key,
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        metadata: response.Metadata,
        storageClass: response.StorageClass,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: error.name || 'MetadataError',
        message: error.message || 'Failed to get metadata',
      },
    };
  }
}

