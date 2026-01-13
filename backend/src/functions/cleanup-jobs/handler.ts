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
    // 1. Find jobs older than 1 year that need archiving
    const jobsToArchive = await prisma.job.findMany({
      where: {
        endTime: { lt: oneYearAgo },
        archivedAt: null,
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            company: true,
          }
        },
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
          }
        },
        quote: {
          select: {
            id: true,
            quoteNumber: true,
            total: true,
          }
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            paymentStatus: true,
          }
        },
        recurrence: {
          select: {
            id: true,
            title: true,
            frequency: true,
          }
        },
      },
    })
    
    console.log(`Found ${jobsToArchive.length} jobs to archive`)
    
    // 2. Archive each job to S3
    for (const job of jobsToArchive) {
      try {
        const archiveKey = `archives/jobs/${job.tenantId}/${job.id}.json`
        
        // Prepare archive data with metadata
        const archiveData = {
          ...job,
          archivedDate: now.toISOString(),
          retentionPolicy: '1-year',
        }
        
        if (!dryRun) {
          // Upload to S3
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
          
          // Mark as archived in database (don't delete yet - keep for reference)
          await prisma.job.update({
            where: { id: job.id },
            data: { archivedAt: now },
          })
          
          console.log(`Archived job ${job.id} to ${archiveKey}`)
        } else {
          console.log(`[DRY RUN] Would archive job ${job.id} to ${archiveKey}`)
        }
        
        archivedCount++
      } catch (error: any) {
        const errorMsg = `Failed to archive job ${job.id}: ${error.message}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }
    
    // 3. Find jobs that have been archived and are ready for deletion
    // Keep archived jobs in DB for a grace period (e.g., 30 days after archiving)
    const gracePeriodDays = 30
    const gracePeriodDate = new Date(now)
    gracePeriodDate.setDate(gracePeriodDate.getDate() - gracePeriodDays)
    
    const jobsToDelete = await prisma.job.findMany({
      where: {
        archivedAt: {
          not: null,
          lt: gracePeriodDate,
        },
      },
      select: {
        id: true,
        tenantId: true,
        title: true,
        archivedAt: true,
      },
    })
    
    console.log(`Found ${jobsToDelete.length} archived jobs ready for deletion (older than ${gracePeriodDays} days)`)
    
    // 4. Delete old archived jobs from database
    if (jobsToDelete.length > 0) {
      if (!dryRun) {
        const deleteResult = await prisma.job.deleteMany({
          where: {
            id: {
              in: jobsToDelete.map(j => j.id),
            },
          },
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
