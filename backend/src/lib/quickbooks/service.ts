// Orchestration layer used by the data Lambda handler. One function per route action.

import { createHmac } from 'crypto'
import { ApiError } from '../errors'
import { loadQuickBooksConfig, QBO_SCOPE_PAYMENTS } from './config'
import { buildAuthorizeUrl, verifyState, exchangeCodeForTokens, revokeToken } from './oauth'
import { saveTokens, getConnectionRecord } from './client'
import { decryptToken } from './crypto'
import { pushInvoice, reconcileInvoice, reconcilePayment } from './sync'
import type { QuickBooksStatus, SyncInvoiceResult } from './types'

async function getPrisma(): Promise<any> {
  const { default: prisma } = await import('../db')
  return prisma as any
}

// Whether this connection carries QuickBooks Payments authorization. Intuit's token-bearer
// response does NOT echo back a `scope` field for the QBO accounting/payment scopes, so the old
// `tokens.scope` check was always falsy and `paymentsConnected` was permanently stuck false.
// Derive it instead from the scopes CleanDock requested (the consent screen grants them).
// NOTE: this reflects that the payment scope was granted, not whether the company has finished
// QuickBooks Payments merchant enrollment — the actual per-invoice pay link is still gated
// separately by isUsablePayUrl().
function paymentsScopeGranted(): boolean {
  return loadQuickBooksConfig().scopes.includes(QBO_SCOPE_PAYMENTS)
}

export async function getStatus(tenantId: string): Promise<QuickBooksStatus> {
  const record = await getConnectionRecord(tenantId)
  if (!record || record.status === 'disconnected') {
    return { connected: false, paymentsConnected: false, status: 'not_connected' }
  }
  return {
    connected: record.status === 'connected',
    realmId: record.realmId,
    paymentsConnected: paymentsScopeGranted(),
    status: record.status,
    lastSyncAt: record.lastSyncAt ? record.lastSyncAt.toISOString() : null,
    lastErrorMessage: record.lastErrorMessage ?? null,
  }
}

export function getConnectUrl(tenantId: string): { url: string } {
  return { url: buildAuthorizeUrl(tenantId) }
}

// Exchange the Intuit authorization code for tokens and persist the connection.
export async function connect(
  tenantId: string,
  userId: string,
  params: { code: string; realmId: string; state: string }
): Promise<QuickBooksStatus> {
  if (!params.code || !params.realmId) throw new ApiError('Missing code or realmId', 400)
  if (!verifyState(params.state, tenantId)) throw new ApiError('Invalid OAuth state', 400)

  const tokens = await exchangeCodeForTokens(params.code)
  const paymentsConnected = paymentsScopeGranted()
  await saveTokens(tenantId, params.realmId, tokens, {
    connectedByUserId: userId,
    paymentsConnected,
  })
  return getStatus(tenantId)
}

export async function disconnect(tenantId: string): Promise<{ success: true }> {
  const prisma = await getPrisma()
  const record = await getConnectionRecord(tenantId)
  if (record) {
    try {
      await revokeToken(decryptToken(record.refreshToken))
    } catch {
      // Best-effort revoke with Intuit; always clear local state regardless.
    }
    await prisma.quickBooksConnection.update({
      where: { tenantId },
      data: { status: 'disconnected' },
    })
  }
  return { success: true }
}

export async function syncInvoice(
  tenantId: string,
  invoiceId: string,
  opts: { sendEmail?: boolean } = {}
): Promise<SyncInvoiceResult> {
  if (!invoiceId) throw new ApiError('invoiceId is required', 400)
  return pushInvoice(tenantId, invoiceId, opts)
}

// Inbound Intuit webhook. Intuit signs the raw body with HMAC-SHA256 (base64) using the app's
// Webhook Verifier Token. Events are de-duped via the QuickBooksWebhookEvent table.
export async function handleWebhook(
  rawBody: string,
  signature: string
): Promise<{ received: true }> {
  const cfg = loadQuickBooksConfig()
  if (!cfg.webhookVerifierToken) throw new ApiError('QuickBooks webhooks not configured', 400)

  const expected = createHmac('sha256', cfg.webhookVerifierToken).update(rawBody).digest('base64')
  if (!signature || signature !== expected) throw new ApiError('Invalid webhook signature', 401)

  const prisma = await getPrisma()
  const payload = JSON.parse(rawBody || '{}')

  for (const notification of payload.eventNotifications || []) {
    const realmId = notification.realmId
    const connection = await prisma.quickBooksConnection.findFirst({ where: { realmId } })
    if (!connection) continue

    for (const entity of notification.dataChangeEvent?.entities || []) {
      const eventId = `${realmId}:${entity.name}:${entity.id}:${entity.lastUpdated}`
      const seen = await prisma.quickBooksWebhookEvent.findUnique({ where: { eventId } })
      if (seen) continue

      // v1 cares about Invoice/Payment changes for reconciliation. Isolate failures per entity:
      // on error, leave the event unrecorded so Intuit's retry can reprocess it.
      try {
        if (entity.name === 'Invoice') {
          await reconcileInvoice(connection.tenantId, String(entity.id))
        } else if (entity.name === 'Payment') {
          await reconcilePayment(connection.tenantId, String(entity.id))
        }
        await prisma.quickBooksWebhookEvent.create({ data: { eventId, realmId } })
      } catch (err: any) {
        console.error(
          `QuickBooks webhook: failed to process ${entity.name} ${entity.id}:`,
          err?.message
        )
      }
    }
  }

  return { received: true }
}
