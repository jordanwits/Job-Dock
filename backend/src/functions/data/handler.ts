import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { successResponse, errorResponse, corsResponse } from '../../lib/middleware'
import { dataServices } from '../../lib/dataService'
import { extractTenantId } from '../../lib/middleware'
import { ensureTenantExists, getDefaultTenantId } from '../../lib/tenant'
import { ApiError } from '../../lib/errors'

type ResourceKey = keyof typeof dataServices

interface ParsedPath {
  resource?: ResourceKey
  id?: string
  action?: string
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse()
  }

  try {
    const { resource, id, action } = parsePath(event)
    const tenantId = await resolveTenantId(event)
    await ensureTenantExists(tenantId)

    if (!resource) {
      return successResponse({ status: 'ok' })
    }

    const service = dataServices[resource]
    if (!service) {
      return errorResponse('Route not found', 404)
    }

    switch (event.httpMethod) {
      case 'GET':
        return successResponse(await handleGet(resource, service, tenantId, id, action, event))
      case 'POST':
        return successResponse(await handlePost(service, tenantId, event))
      case 'PUT':
      case 'PATCH':
        if (!id) {
          return errorResponse('Resource ID required', 400)
        }
        return successResponse(await handlePut(service, tenantId, id, event))
      case 'DELETE':
        if (!id) {
          return errorResponse('Resource ID required', 400)
        }
        return successResponse(await service.delete(tenantId, id))
      default:
        return errorResponse('Method not allowed', 405)
    }
  } catch (error) {
    console.error('Data API error:', error)
    if (error instanceof ApiError) {
      return errorResponse(error, error.statusCode)
    }
    return errorResponse(error instanceof Error ? error : 'Internal server error', 500)
  }
}

async function handleGet(
  resource: ResourceKey,
  service: (typeof dataServices)[ResourceKey],
  tenantId: string,
  id: string | undefined,
  action: string | undefined,
  event: APIGatewayProxyEvent
) {
  if (resource === 'services' && id && action === 'booking-link') {
    return (service as typeof dataServices.services).getBookingLink(tenantId, id)
  }

  if (id) {
    return service.getById(tenantId, id)
  }

  if (resource === 'jobs') {
    const startDateStr = event.queryStringParameters?.startDate
    const endDateStr = event.queryStringParameters?.endDate
    const startDate = startDateStr ? new Date(startDateStr) : undefined
    const endDate = endDateStr ? new Date(endDateStr) : undefined
    return (service as typeof dataServices.jobs).getAll(tenantId, startDate, endDate)
  }

  return service.getAll(tenantId)
}

async function handlePost(
  service: (typeof dataServices)[ResourceKey],
  tenantId: string,
  event: APIGatewayProxyEvent
) {
  const payload = parseBody(event)
  return service.create(tenantId, payload)
}

async function handlePut(
  service: (typeof dataServices)[ResourceKey],
  tenantId: string,
  id: string,
  event: APIGatewayProxyEvent
) {
  const payload = parseBody(event)
  return service.update(tenantId, id, payload)
}

function parseBody(event: APIGatewayProxyEvent) {
  if (!event.body) {
    throw new Error('Request body required')
  }

  try {
    return JSON.parse(event.body)
  } catch {
    throw new Error('Invalid JSON body')
  }
}

function parsePath(event: APIGatewayProxyEvent): ParsedPath {
  const normalizedPath = normalizePath(event)
  const segments = normalizedPath.split('/').filter(Boolean)

  const resource = segments[0] as ResourceKey | undefined
  const id = segments[1]
  const action = segments[2]

  return { resource, id, action }
}

function normalizePath(event: APIGatewayProxyEvent) {
  const stage = event.requestContext?.stage
  let path = event.path || '/'

  if (stage && path.startsWith(`/${stage}`)) {
    path = path.slice(stage.length + 1)
    if (!path.startsWith('/')) {
      path = `/${path}`
    }
  }

  return path
}

async function resolveTenantId(event: APIGatewayProxyEvent) {
  try {
    return await extractTenantId(event)
  } catch {
    const fallback = getDefaultTenantId()
    if (!fallback) {
      throw new Error('Tenant ID not provided')
    }
    return fallback
  }
}

