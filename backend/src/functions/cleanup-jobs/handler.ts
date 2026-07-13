/**
 * Job Cleanup Lambda
 *
 * This Lambda function runs on a schedule to:
 * 1. Snapshot jobs whose bookings ended over 1 year ago to S3
 * 2. Archive those old bookings (and the job itself once no active bookings remain)
 *
 * It never deletes rows from the database. Archived jobs stay in the Archive tab
 * until a user permanently deletes them — a user deleting a single calendar
 * appointment (which archives that booking) must never cost them the job.
 *
 * Scheduled to run: Weekly via EventBridge
 */

import { Context } from 'aws-lambda'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import prisma from '../../lib/db'
import { loadSecrets } from '../../lib/secrets'

const s3 = new S3Client({})

interface CleanupEvent {
  dryRun?: boolean  // If true, logs what would be done without making changes
}

interface CleanupResult {
  success: boolean
  archived: number
  deleted: number
  errors: string[]
  timestamp: string
  dryRun: boolean
}

export const handler = async (
  event: CleanupEvent = {},
  context: Context
): Promise<CleanupResult> => {
  console.log('Job Cleanup Lambda invoked', { event, requestId: context.awsRequestId })

  await loadSecrets()

  const dryRun = event.dryRun || false
  const now = new Date()
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

  const errors: string[] = []
  let archivedCount = 0

  try {
    // 1. Find bookings older than 1 year that need archiving
    const bookingsToArchive = await prisma.booking.findMany({
      where: {
        endTime: { lt: oneYearAgo },
        archivedAt: null,
      },
      select: { jobId: true },
    })

    // Independent appointments (null jobId) have no job to archive
    const jobIdsToArchive = [
      ...new Set(bookingsToArchive.map(b => b.jobId).filter((id): id is string => id != null)),
    ]
    console.log(`Found ${jobIdsToArchive.length} jobs with year-old bookings to archive`)

    // 2. Snapshot each job to S3, then archive only its year-old bookings
    for (const jobId of jobIdsToArchive) {
      try {
        const job = await prisma.job.findFirst({
          where: { id: jobId },
          include: {
            contact: true,
            bookings: { include: { service: true } },
          },
        })
        if (!job) continue

        const archiveKey = `archives/jobs/${job.tenantId}/${job.id}.json`
        const archiveData = {
          ...job,
          archivedDate: now.toISOString(),
          retentionPolicy: '1-year',
        }

        if (!dryRun) {
          await s3.send(new PutObjectCommand({
            Bucket: process.env.FILES_BUCKET!,
            Key: archiveKey,
            Body: JSON.stringify(archiveData, null, 2),
            ContentType: 'application/json',
            Metadata: {
              tenantId: job.tenantId,
              jobId: job.id,
              archivedDate: now.toISOString(),
            },
          }))
          // Only the bookings that are actually over a year old — an active
          // recurring series keeps its current and future appointments.
          await prisma.booking.updateMany({
            where: { jobId, endTime: { lt: oneYearAgo }, archivedAt: null },
            data: { archivedAt: now },
          })
          // Archive the job itself only once it has no active bookings left,
          // so it moves to the Archive tab instead of lingering unscheduled.
          const activeBookings = await prisma.booking.count({
            where: { jobId, archivedAt: null },
          })
          if (activeBookings === 0 && !job.archivedAt) {
            await prisma.job.update({
              where: { id: jobId },
              data: { archivedAt: now },
            })
          }
          console.log(`Archived job ${job.id} to ${archiveKey}`)
        } else {
          console.log(`[DRY RUN] Would archive job ${job.id} to ${archiveKey}`)
        }
        archivedCount++
      } catch (error: any) {
        const errorMsg = `Failed to archive job ${jobId}: ${error.message}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    return {
      success: true,
      archived: archivedCount,
      deleted: 0,
      errors,
      timestamp: now.toISOString(),
      dryRun,
    }

  } catch (error: any) {
    console.error('Job cleanup failed:', error)
    errors.push(`Fatal error: ${error.message}`)

    return {
      success: false,
      archived: archivedCount,
      deleted: 0,
      errors,
      timestamp: now.toISOString(),
      dryRun,
    }
  } finally {
    await prisma.$disconnect()
  }
}
