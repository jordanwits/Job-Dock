/**
 * Job Cleanup Lambda
 * 
 * This Lambda function runs on a schedule to:
 * 1. Archive jobs older than 1 year to S3
 * 2. Delete archived jobs from the database
 * 
 * Scheduled to run: Weekly via EventBridge
 */

import { Context } from 'aws-lambda'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import prisma from '../../lib/db'

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
  
  const dryRun = event.dryRun || false
  const now = new Date()
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  
  const errors: string[] = []
  let archivedCount = 0
  let deletedCount = 0
  
  try {
    // 1. Find bookings older than 1 year that need archiving
    const bookingsToArchive = await prisma.booking.findMany({
      where: {
        endTime: { lt: oneYearAgo },
        archivedAt: null,
      },
      include: {
        job: {
          include: {
            contact: true,
            bookings: { include: { service: true } },
          },
        },
      },
    })
    
    const jobIdsToArchive = [...new Set(bookingsToArchive.map(b => b.jobId))]
    console.log(`Found ${jobIdsToArchive.length} jobs to archive`)
    
    // 2. Archive each job to S3
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
          await prisma.booking.updateMany({
            where: { jobId },
            data: { archivedAt: now },
          })
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
    
    // 3. Find bookings archived long ago, ready for deletion
    const gracePeriodDays = 30
    const gracePeriodDate = new Date(now)
    gracePeriodDate.setDate(gracePeriodDate.getDate() - gracePeriodDays)
    
    const oldArchivedBookings = await prisma.booking.findMany({
      where: {
        archivedAt: { not: null, lt: gracePeriodDate },
      },
      select: { jobId: true },
    })
    const jobsToDelete = [...new Set(oldArchivedBookings.map(b => b.jobId))]
    
    console.log(`Found ${jobsToDelete.length} archived jobs ready for deletion (older than ${gracePeriodDays} days)`)
    
    if (jobsToDelete.length > 0) {
      if (!dryRun) {
        const deleteResult = await prisma.job.deleteMany({
          where: { id: { in: jobsToDelete } },
        })
        
        deletedCount = deleteResult.count
        console.log(`Deleted ${deletedCount} archived jobs from database`)
      } else {
        deletedCount = jobsToDelete.length
        console.log(`[DRY RUN] Would delete ${deletedCount} archived jobs from database`)
      }
    }
    
    return {
      success: true,
      archived: archivedCount,
      deleted: deletedCount,
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
      deleted: deletedCount,
      errors,
      timestamp: now.toISOString(),
      dryRun,
    }
  } finally {
    await prisma.$disconnect()
  }
}
