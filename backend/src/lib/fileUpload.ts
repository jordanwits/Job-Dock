import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })
const FILES_BUCKET = process.env.FILES_BUCKET || ''

export interface UploadResult {
  key: string
  url: string
  bucket: string
}

/**
 * Upload a file to S3
 */
export async function uploadFile(params: {
  buffer: Buffer
  filename: string
  contentType: string
  folder?: string
}): Promise<UploadResult> {
  const { buffer, filename, contentType, folder = 'uploads' } = params
  
  // Generate a unique key
  const ext = filename.split('.').pop()
  const key = `${folder}/${randomUUID()}.${ext}`
  
  await s3Client.send(
    new PutObjectCommand({
      Bucket: FILES_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  )
  
  // Generate a signed URL for accessing the file (valid for 1 hour)
  const url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: FILES_BUCKET,
      Key: key,
    }),
    { expiresIn: 3600 }
  )
  
  return {
    key,
    url,
    bucket: FILES_BUCKET,
  }
}

/**
 * Delete a file from S3
 */
export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: FILES_BUCKET,
      Key: key,
    })
  )
}

/**
 * Get a signed URL for a file
 */
export async function getFileUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: FILES_BUCKET,
      Key: key,
    }),
    { expiresIn }
  )
}

/**
 * Get file buffer from S3 (for proxy streaming)
 */
export async function getFileBuffer(key: string): Promise<{ buffer: Buffer; contentType?: string }> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: FILES_BUCKET,
      Key: key,
    })
  )
  const body = response.Body
  if (!body) {
    throw new Error('Empty file')
  }
  const buffer = Buffer.from(await body.transformToByteArray())
  const contentType = response.ContentType ?? undefined
  return { buffer, contentType }
}

/**
 * Parse multipart form data from API Gateway event body
 * This is a simple implementation that works with base64-encoded bodies
 */
export function parseMultipartFormData(body: string, contentType: string): {
  fields: Record<string, string>
  files: Array<{ fieldname: string; filename: string; contentType: string; buffer: Buffer }>
} {
  const boundary = contentType.split('boundary=')[1]
  if (!boundary) {
    throw new Error('No boundary found in Content-Type')
  }
  
  // API Gateway base64 encodes binary data
  // Try to decode, if it fails, use as-is
  let buffer: Buffer
  try {
    buffer = Buffer.from(body, 'base64')
  } catch (error) {
    console.warn('Failed to decode base64, using body as-is')
    buffer = Buffer.from(body)
  }
  
  const parts = buffer.toString('binary').split(`--${boundary}`)
  
  const fields: Record<string, string> = {}
  const files: Array<{ fieldname: string; filename: string; contentType: string; buffer: Buffer }> = []
  
  for (const part of parts) {
    if (part.trim() === '' || part.trim() === '--') continue
    
    const [headerSection, ...bodyParts] = part.split('\r\n\r\n')
    if (!headerSection) continue
    
    const headers = headerSection.split('\r\n')
    const contentDisposition = headers.find(h => h.toLowerCase().startsWith('content-disposition:'))
    const partContentType = headers.find(h => h.toLowerCase().startsWith('content-type:'))
    
    if (!contentDisposition) continue
    
    const nameMatch = contentDisposition.match(/name="([^"]+)"/)
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
    
    if (!nameMatch) continue
    
    const fieldname = nameMatch[1]
    const bodyContent = bodyParts.join('\r\n\r\n').replace(/\r\n--$/, '')
    
    if (filenameMatch) {
      // This is a file
      const filename = filenameMatch[1]
      const fileContentType = partContentType ? partContentType.split(':')[1].trim() : 'application/octet-stream'
      const fileBuffer = Buffer.from(bodyContent, 'binary')
      
      files.push({
        fieldname,
        filename,
        contentType: fileContentType,
        buffer: fileBuffer,
      })
    } else {
      // This is a regular field
      fields[fieldname] = bodyContent.trim()
    }
  }
  
  return { fields, files }
}

