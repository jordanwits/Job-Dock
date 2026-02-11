-- Update existing job_logs with status 'archived' to 'inactive' for consistency
UPDATE "job_logs" SET "status" = 'inactive' WHERE "status" = 'archived';
